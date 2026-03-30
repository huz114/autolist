/**
 * ジョブポーリング・自動復旧モジュール
 *
 * 1. サーバー起動時: running ジョブを pending にリセット → pending ジョブを処理開始
 * 2. 2分おきのポーリング: pending ジョブチェック + スタックジョブ検知
 * 3. タイムアウト超過した running ジョブを自動リトライ（最大1回）→ 超過で failed + LINE通知
 *
 * スタック検知ロジック:
 * - 収集済み0件 → pending に戻してリトライ（最大1回）
 * - 収集済み1件以上 → LINE中間通知 → pending に戻してリトライ1回 → 結果に応じて最終通知
 */

import { prisma } from './prisma';
import { sendMessage } from './line';
import { processAllPendingJobs } from './job-processor';
import { suggestAlternativeKeywords } from './suggest-keywords';

let isProcessing = false;

/** リトライ上限回数 */
const MAX_RETRY_COUNT = 1;

/**
 * LineUser から lineUserId を取得するヘルパー
 */
async function getLineUserIdForUser(userId: string): Promise<string | null> {
  const lineUser = await prisma.lineUser.findFirst({
    where: { userId },
    select: { lineUserId: true },
  });
  return lineUser?.lineUserId ?? null;
}

/**
 * ポーリング初期化（instrumentation.ts から呼ばれる）
 */
export function initJobPoller() {
  console.log('[JobPoller] Server starting - initializing job recovery and polling...');

  // 少し待ってからDB操作（Prisma初期化待ち）
  setTimeout(async () => {
    try {
      await recoverStuckJobs();
      await startProcessingIfNeeded();
    } catch (error) {
      console.error('[JobPoller] Error during startup recovery:', error);
    }
  }, 5000);

  // 2分おきのポーリング開始
  setInterval(async () => {
    try {
      await handleStuckJobs();
      await startProcessingIfNeeded();
    } catch (error) {
      console.error('[JobPoller] Polling error:', error);
    }
  }, 2 * 60 * 1000); // 2分

  console.log('[JobPoller] Polling interval set (every 2 minutes)');
}

/**
 * 対策1: サーバー起動時に running ジョブを pending にリセット
 * ※ retryCount はインクリメントしない（サーバー再起動は正常復旧であり、リトライ扱いにしない）
 */
async function recoverStuckJobs() {
  const runningJobs = await prisma.listJob.updateMany({
    where: { status: 'running' },
    data: { status: 'pending' },
    // progress はそのまま維持（途中再開用）
  });

  if (runningJobs.count > 0) {
    console.log(`[JobPoller] Recovered ${runningJobs.count} running job(s) -> pending`);
  } else {
    console.log('[JobPoller] No running jobs to recover');
  }
}

/**
 * 対策2: pending ジョブがあれば処理を開始（二重処理防止付き）
 */
export async function startProcessingIfNeeded() {
  if (isProcessing) {
    console.log('[JobPoller] Already processing, skipping...');
    return;
  }

  const pendingCount = await prisma.listJob.count({
    where: { status: 'pending' },
  });

  if (pendingCount === 0) {
    return;
  }

  console.log(`[JobPoller] Found ${pendingCount} pending job(s), starting processing...`);

  isProcessing = true;
  try {
    const processed = await processAllPendingJobs();
    console.log(`[JobPoller] Processed ${processed} job(s)`);
  } catch (error) {
    console.error('[JobPoller] Error processing jobs:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * 対策3: タイムアウト超過した running ジョブを自動リトライ or failed 化
 *
 * タイムアウト計算: 残り件数 × 2分 + 20分（動的タイムアウト）
 * - 残り50件 → 120分（2時間）
 * - 残り100件 → 220分（3.7時間）
 * - 最低でも20分は確保
 */
async function handleStuckJobs() {
  // running 状態のジョブを全件取得
  const runningJobs = await prisma.listJob.findMany({
    where: { status: 'running' },
  });

  if (runningJobs.length === 0) {
    return;
  }

  for (const job of runningJobs) {
    // 収集済み件数を取得
    const collectedCount = await prisma.collectedUrl.count({
      where: { jobId: job.id, hasForm: true, companyVerified: true },
    });

    // 動的タイムアウト: 残り件数 × 2分 + 20分
    const remainingCount = Math.max(0, job.targetCount - collectedCount);
    const timeoutMs = (remainingCount * 2 + 20) * 60 * 1000;
    const elapsed = Date.now() - job.updatedAt.getTime();

    // まだタイムアウトしていない場合はスキップ
    if (elapsed < timeoutMs) {
      continue;
    }

    const timeoutMinutes = Math.round(timeoutMs / 60000);
    console.log(
      `[JobPoller] Job ${job.id} stuck (elapsed: ${Math.round(elapsed / 60000)}min, ` +
      `timeout: ${timeoutMinutes}min, retryCount: ${job.retryCount}, collected: ${collectedCount})`
    );

    // LINE通知用の lineUserId を取得
    const lineUserId = await getLineUserIdForUser(job.userId);

    try {
      const autolistUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
      const loginUrl = lineUserId
        ? `${autolistUrl}/login?lineUserId=${lineUserId}&callbackUrl=/my-lists&openExternalBrowser=1`
        : `${autolistUrl}/my-lists?openExternalBrowser=1`;

      if (collectedCount === 0) {
        // ── 収集済み0件のケース ──
        if (job.retryCount < MAX_RETRY_COUNT) {
          // リトライ可能: pending に戻す
          await prisma.listJob.update({
            where: { id: job.id },
            data: {
              status: 'pending',
              retryCount: job.retryCount + 1,
            },
          });

          console.log(
            `[JobPoller] Job ${job.id} (0件) -> pending (retry ${job.retryCount + 1}/${MAX_RETRY_COUNT})`
          );
        } else {
          // リトライ上限超過: failed + キーワード提案
          await prisma.listJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              totalFound: 0,
            },
          });

          if (lineUserId) {
            try {
              let keywordSuggestion = '';
              try {
                const suggestions = await suggestAlternativeKeywords(job.keyword);
                if (suggestions.length > 0) {
                  keywordSuggestion = '\n\n以下のキーワードで追加収集できる可能性があります：\n' +
                    suggestions.map(s => `・${s}`).join('\n');
                }
              } catch (e) {
                console.error(`[JobPoller] Failed to generate keyword suggestions:`, e);
              }

              await sendMessage(lineUserId,
                `申し訳ありません。「${job.keyword}」の収集を試みましたが、条件に合う企業が見つかりませんでした。\n\n` +
                `クレジットは消費されていません。${keywordSuggestion}\n\n` +
                `別のキーワードで再度お試しください。`
              );
            } catch (lineError) {
              console.error(`[JobPoller] Failed to send LINE notification for job ${job.id}:`, lineError);
            }
          }

          console.log(
            `[JobPoller] Job ${job.id} (0件) -> failed (exceeded ${MAX_RETRY_COUNT} retries)`
          );
        }
      } else {
        // ── 収集済み1件以上のケース ──
        if (job.retryCount < MAX_RETRY_COUNT) {
          // 中間通知を送信してからリトライ
          if (lineUserId) {
            try {
              await sendMessage(lineUserId,
                `📋 「${job.keyword}」の収集状況をお知らせします。\n\n` +
                `現在${collectedCount}件の企業を収集できました。\n` +
                `リストはこちらから確認できます：\n${loginUrl}\n\n` +
                `残りは引き続き収集中です。完了したら改めてお知らせします。`
              );
            } catch (lineError) {
              console.error(`[JobPoller] Failed to send interim LINE notification for job ${job.id}:`, lineError);
            }
          }

          // totalFoundを中間更新（マイリストで件数を表示できるように）
          await prisma.listJob.update({
            where: { id: job.id },
            data: {
              status: 'pending',
              retryCount: job.retryCount + 1,
              totalFound: collectedCount,
            },
          });

          console.log(
            `[JobPoller] Job ${job.id} (${collectedCount}件) -> interim notification sent, pending for retry`
          );
        } else {
          // リトライ済み: 最終結果を確定
          // リトライ後に追加で収集できたか確認
          const previousCount = job.totalFound ?? 0;
          const additionalCount = collectedCount - previousCount;

          await prisma.listJob.update({
            where: { id: job.id },
            data: {
              status: 'failed',
              totalFound: collectedCount,
            },
          });

          if (lineUserId) {
            try {
              let keywordSuggestion = '';
              try {
                const suggestions = await suggestAlternativeKeywords(job.keyword);
                if (suggestions.length > 0) {
                  keywordSuggestion = '\n\n以下のキーワードで追加収集できる可能性があります：\n' +
                    suggestions.map(s => `・${s}`).join('\n');
                }
              } catch (e) {
                console.error(`[JobPoller] Failed to generate keyword suggestions:`, e);
              }

              const message = additionalCount > 0
                ? `📋 「${job.keyword}」の追加収集が完了しました。\n\n` +
                  `さらに${additionalCount}件収集できました。合計${collectedCount}件になりました。\n\n` +
                  `これ以上の収集が難しいため、こちらが最終結果となります。\n` +
                  `リストはこちらから確認できます：\n${loginUrl}\n\n` +
                  `クレジットはリスト確定時に実績分のみ課金されます。${keywordSuggestion}`
                : `📋 「${job.keyword}」の追加収集を試みましたが、これ以上見つかりませんでした。\n\n` +
                  `最終結果は${collectedCount}件です。\n` +
                  `リストはこちらから確認できます：\n${loginUrl}\n\n` +
                  `クレジットはリスト確定時に実績分のみ課金されます。${keywordSuggestion}`;

              await sendMessage(lineUserId, message);
            } catch (lineError) {
              console.error(`[JobPoller] Failed to send LINE notification for job ${job.id}:`, lineError);
            }
          }

          console.log(
            `[JobPoller] Job ${job.id} (${collectedCount}件, +${additionalCount}) -> failed (final after retry)`
          );
        }
      }
    } catch (error) {
      console.error(`[JobPoller] Error handling stuck job ${job.id}:`, error);
    }
  }
}
