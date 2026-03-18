/**
 * ジョブポーリング・自動復旧モジュール
 *
 * 1. サーバー起動時: running ジョブを pending にリセット → pending ジョブを処理開始
 * 2. 2分おきのポーリング: pending ジョブチェック + スタックジョブ検知
 * 3. タイムアウト超過した running ジョブを自動リトライ（最大3回）→ 超過で failed + LINE通知
 */

import { prisma } from './prisma';
import { sendMessage } from './line';
import { processAllPendingJobs } from './job-processor';

let isProcessing = false;

/** リトライ上限回数 */
const MAX_RETRY_COUNT = 3;

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
 * タイムアウト計算: 依頼件数 × 3分 + 30分（動的タイムアウト）
 * - 100件依頼 → 330分（5.5時間）
 * - 300件依頼 → 930分（15.5時間）
 * - 最低でも30分は確保
 *
 * リトライ上限: 3回
 * - retryCount < 3: pending に戻して自動リトライ（retryCount をインクリメント）
 * - retryCount >= 3: failed にして LINE 通知（これ以上リトライしない）
 *
 * 途中再開:
 * - pending に戻されたジョブは processNextJob で再処理される
 * - 既に収集済みの CollectedUrl は job-processor.ts 側でスキップされる
 */
async function handleStuckJobs() {
  // running 状態のジョブを全件取得して、個別にタイムアウト判定する
  const runningJobs = await prisma.listJob.findMany({
    where: { status: 'running' },
    include: { user: true },
  });

  if (runningJobs.length === 0) {
    return;
  }

  for (const job of runningJobs) {
    // 動的タイムアウト: 依頼件数 × 3分 + 30分
    const timeoutMs = (job.targetCount * 3 + 30) * 60 * 1000;
    const elapsed = Date.now() - job.updatedAt.getTime();

    // まだタイムアウトしていない場合はスキップ
    if (elapsed < timeoutMs) {
      continue;
    }

    const timeoutMinutes = Math.round(timeoutMs / 60000);
    console.log(
      `[JobPoller] Job ${job.id} stuck (elapsed: ${Math.round(elapsed / 60000)}min, ` +
      `timeout: ${timeoutMinutes}min, retryCount: ${job.retryCount})`
    );

    try {
      if (job.retryCount < MAX_RETRY_COUNT) {
        // ── リトライ可能: pending に戻して自動リトライ ──
        await prisma.listJob.update({
          where: { id: job.id },
          data: {
            status: 'pending',
            retryCount: job.retryCount + 1,
          },
        });

        console.log(
          `[JobPoller] Job ${job.id} -> pending (retry ${job.retryCount + 1}/${MAX_RETRY_COUNT}). ` +
          `途中収集分は保持、残りから再開予定`
        );
      } else {
        // ── リトライ上限超過: failed にして LINE 通知 ──
        await prisma.listJob.update({
          where: { id: job.id },
          data: { status: 'failed' },
        });

        // LINE通知
        try {
          await sendMessage(
            job.user.lineUserId,
            `⚠️ 収集中にエラーが発生しました。\n\n` +
            `依頼: ${job.keyword}\n` +
            `${MAX_RETRY_COUNT}回の自動リトライを試みましたが完了できませんでした。\n` +
            `クレジットは消費されていません。\n\n` +
            `お手数ですが再度依頼してください。`
          );
        } catch (lineError) {
          console.error(`[JobPoller] Failed to send LINE notification for job ${job.id}:`, lineError);
        }

        console.log(
          `[JobPoller] Job ${job.id} -> failed (exceeded ${MAX_RETRY_COUNT} retries)`
        );
      }
    } catch (error) {
      console.error(`[JobPoller] Error handling stuck job ${job.id}:`, error);
    }
  }
}
