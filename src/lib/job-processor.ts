import { prisma } from './prisma';
import { collectUrlsWithQueries } from './collect-urls';
import { sendMessage } from './line';
import { analyzeQuery } from './analyze-query';
import { importJobToShiryolog } from './import-to-shiryolog';
import { sendJobCompletedEmail } from './mailer';
import { getAdjacentPrefectures } from './adjacent-prefectures';
import { suggestAlternativeKeywords } from './suggest-keywords';

/**
 * pendingのジョブを1件取得して処理する
 *
 * 楽観的ロックで二重処理を防止:
 * 1. findFirst で pending ジョブを取得
 * 2. updateMany で status='pending' の条件付きで running に変更
 * 3. count=0 なら他プロセスが先に取得済み → 次のジョブを探す
 */
export async function processNextJob(): Promise<{ processed: boolean; jobId?: string }> {
  // 楽観的ロック: pendingジョブの取得とrunningへの更新をアトミックに行う
  // 他プロセスに取られた場合はスキップして次のpendingジョブを探す
  let job: Awaited<ReturnType<typeof prisma.listJob.findFirst<{ include: { user: true } }>>> = null;

  while (true) {
    // pendingのジョブを1件取得（古い順）
    const candidate = await prisma.listJob.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { user: true },
    });

    if (!candidate) {
      return { processed: false };
    }

    // 楽観的ロック: statusがまだpendingの場合のみrunningに変更
    // リトライ時はprogressをリセットしない（途中再開のため既存の進捗を維持）
    const updated = await prisma.listJob.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: { status: 'running' },
    });

    if (updated.count === 0) {
      // 他プロセスが先に取得済み → スキップして次のpendingジョブを探す
      console.log(`[processNextJob] Job ${candidate.id} already taken by another process, skipping...`);
      continue;
    }

    job = candidate;
    break;
  }

  console.log(`Processing job: ${job.id}, keyword: ${job.keyword}`);

  try {
    // クエリを解析して検索クエリを生成
    const analyzed = await analyzeQuery(job.keyword);

    // 業種と地域をDBに保存（まだの場合）
    if (!job.industry || !job.location) {
      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          industry: analyzed.industry,
          location: analyzed.location,
          industryKeywords: analyzed.industryKeywords || [],
        },
      });
    }

    // industryKeywordsを確定（DBに保存済みのものを優先、なければanalyzedから）
    const industryKeywords =
      job.industryKeywords.length > 0
        ? job.industryKeywords
        : analyzed.industryKeywords || [];

    // ── リトライ時の途中再開: 既収集件数を確認して残りだけ収集する ──
    const existingCollectedCount = await prisma.collectedUrl.count({
      where: { jobId: job.id, hasForm: true, companyVerified: true },
    });

    // 残り件数を計算（既に収集済み分を差し引く）
    const remainingCount = Math.max(0, job.targetCount - existingCollectedCount);

    if (existingCollectedCount > 0) {
      console.log(
        `[Job ${job.id}] リトライ途中再開: 既収集 ${existingCollectedCount} 件, ` +
        `残り ${remainingCount} 件を追加収集`
      );
    }

    // 残り0件なら収集スキップ（既に目標達成済み）
    let totalFound: number;
    let scrapedCount: number;

    if (remainingCount <= 0) {
      console.log(`[Job ${job.id}] 既に目標件数に到達済み。収集をスキップします。`);
      totalFound = existingCollectedCount;
      scrapedCount = 0;
    } else {
      // URL収集を実行（remainingCountを目標件数として渡す）
      const result = await collectUrlsWithQueries(
        job.id,
        analyzed.searchQueries,
        remainingCount,
        job.userId,
        job.industry ?? null,
        job.location ?? null,
        industryKeywords
      );
      totalFound = result.totalFound;
      scrapedCount = result.scrapedCount;
    }

    // 法人名確認済み（companyVerified=true）の件数を取得（顧客提出用件数）
    const formCount = await prisma.collectedUrl.count({
      where: { jobId: job.id, hasForm: true, companyVerified: true },
    });

    // 完了後のstatus確認（キャンセルされた場合は按分課金）
    const finalJob = await prisma.listJob.findUnique({
      where: { id: job.id },
      select: { status: true },
    });

    const autolistUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
    const targetCount = job.targetCount;
    const lineUserId = job.user.lineUserId;
    const loginUrl = `${autolistUrl}/login?lineUserId=${lineUserId}&callbackUrl=/my-lists`;

    if (finalJob?.status === 'cancelled') {
      // キャンセル：収集済み件数分のみ課金（10件単位切り上げ）
      const actualCount = formCount;
      const chargedCount = actualCount > 0 ? Math.ceil(actualCount / 10) * 10 : 0;

      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          progress: Math.round((actualCount / targetCount) * 100),
          totalFound: actualCount,
          completedAt: new Date(),
          // status は 'cancelled' のまま変更しない
        },
      });

      // 按分課金（収集件数分のみ）
      if (chargedCount > 0) {
        await prisma.lineUser.update({
          where: { id: job.userId },
          data: {
            monthlyCount: { increment: actualCount },
            credits: { decrement: chargedCount },
          },
        });
      }

      // キャンセル完了通知（シリョログ登録済みならメール、未登録はLINE）
      const remainingCredits = job.user.credits - chargedCount;

      const lineUser = await prisma.lineUser.findUnique({
        where: { id: job.userId },
        select: { lineUserId: true, displayName: true, userId: true },
      });

      if (lineUser?.userId) {
        // シリョログ登録済み → メール通知
        const shiryologUser = await prisma.$queryRaw<Array<{email: string, name: string | null}>>`
          SELECT email, name FROM "public"."User" WHERE id = ${lineUser.userId} LIMIT 1
        `;
        if (shiryologUser.length > 0) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
          await sendJobCompletedEmail({
            to: shiryologUser[0].email,
            userName: shiryologUser[0].name || lineUser.displayName || 'お客様',
            keyword: job.keyword,
            industry: job.industry,
            location: job.location,
            totalFound: actualCount,
            myListsUrl: `${appUrl}/my-lists`,
          });
        }
      } else {
        // 未登録 → LINE Push通知
        await sendMessage(job.user.lineUserId,
          `❌ リスト収集をキャンセルしました。\n\n` +
          `収集済み: ${actualCount}社\n` +
          `課金: ${chargedCount}件分\n` +
          `💳 残クレジット: ${remainingCredits}件\n\n` +
          `収集済みのリストはこちらから確認できます 🔗\n` +
          loginUrl + '\n\n' +
          `📧 シリョログに登録するとメールで完了通知が届きます`
        );
      }

      console.log(`Job ${job.id} cancelled. Found ${actualCount} URLs, charged ${chargedCount} credits.`);

    } else {
      // 通常完了: ジョブをcompletedに更新
      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          progress: 100,
          totalFound: formCount,
          completedAt: new Date(),
        },
      });

      // クレジット消費は確定ボタン押下時に実行（/api/confirm-list/[jobId]）
      // ここでは消費しない
      const updatedLineUser = await prisma.lineUser.findUnique({
        where: { id: job.userId },
        select: { credits: true, lineUserId: true, displayName: true, userId: true },
      });
      if (!updatedLineUser) throw new Error('User not found');
      const remainingCreditsAfterCompletion = updatedLineUser.credits;

      // 完了通知（シリョログ登録済みならメール、未登録はLINE）
      const lineUserForNotification = updatedLineUser;

      if (lineUserForNotification.userId) {
        // シリョログ登録済み → メール通知
        const shiryologUser = await prisma.$queryRaw<Array<{email: string, name: string | null}>>`
          SELECT email, name FROM "public"."User" WHERE id = ${lineUserForNotification.userId} LIMIT 1
        `;
        if (shiryologUser.length > 0) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
          await sendJobCompletedEmail({
            to: shiryologUser[0].email,
            userName: shiryologUser[0].name || lineUserForNotification.displayName || 'お客様',
            keyword: job.keyword,
            industry: job.industry,
            location: job.location,
            totalFound: formCount,
            myListsUrl: `${appUrl}/my-lists`,
          });
        }
      } else {
        // 未登録 → LINE Push通知
        const completionMessage = formCount >= targetCount
          ? `✅ リストが完成しました！
📋 ${formCount}社のフォームあり企業リストを収集しました

💳 ${formCount}クレジット使用 → 残り${remainingCreditsAfterCompletion}クレジット

ログインしてリストを確認・送信できます 🔗
${loginUrl}

📧 シリョログに登録するとメールで完了通知が届きます`
          : (() => {
            // 近隣地域提案を生成（未達時のみ）
            const location = job.location ?? analyzed.location ?? '';
            const industry = job.industry ?? analyzed.industry ?? '';
            const adjacentPrefectures = location ? getAdjacentPrefectures(location) : [];
            const suggestions = adjacentPrefectures.slice(0, 3);

            const suggestionBlock = suggestions.length > 0
              ? `\n📍 近隣の地域でも試してみませんか？\n` +
                suggestions.map(pref => `・「${industry} ${pref} ${targetCount}社」`).join('\n') +
                '\n'
              : '';

            return `✅ リストが完成しました！
📋 ${formCount}社のフォームあり企業リストを収集しました
（目標${targetCount}社に対し、Google検索${scrapedCount}件分のURLを調べましたが、フォームのある企業が${formCount}社でした）

💳 ${formCount}クレジット使用 → 残り${remainingCreditsAfterCompletion}クレジット
${suggestionBlock}
ログインしてリストを確認・送信できます 🔗
${loginUrl}

📧 シリョログに登録するとメールで完了通知が届きます`;
          })();

        await sendMessage(job.user.lineUserId, completionMessage);
      }

      // シリョログの Company テーブルへの自動インポート（一時無効化）
      // TODO: データ品質改善後に再有効化する
      // try {
      //   const imported = await importJobToShiryolog(job.id);
      //   console.log(`Imported ${imported} companies to Shiryolog from job ${job.id}`);
      // } catch (e) {
      //   console.error('Failed to import to Shiryolog:', e);
      // }

      console.log(`Job ${job.id} completed. Found ${totalFound} URLs.`);
    }

    return { processed: true, jobId: job.id };
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error);

    // ── エラー時の自動リトライ判定 ──
    // retryCount < 1: pending に戻して自動リトライ（途中収集分は保持）
    // retryCount >= 1: failed にして LINE 通知
    const MAX_RETRY = 1;
    const currentRetryCount = job.retryCount ?? 0;

    // 収集済み件数を確認
    const partialCount = await prisma.collectedUrl.count({
      where: { jobId: job.id, hasForm: true, companyVerified: true },
    });

    if (currentRetryCount < MAX_RETRY) {
      // リトライ可能

      // 収集済みが1件以上ある場合は中間通知を送信
      if (partialCount > 0) {
        try {
          const autolistUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
          const loginUrl = `${autolistUrl}/login?lineUserId=${job.user.lineUserId}&callbackUrl=/my-lists`;

          await sendMessage(job.user.lineUserId,
            `📋 「${job.keyword}」の収集状況をお知らせします。\n\n` +
            `現在${partialCount}件の企業を収集できました。\n` +
            `リストはこちらから確認できます：\n${loginUrl}\n\n` +
            `残りは引き続き収集中です。完了したら改めてお知らせします。`
          );
        } catch (lineError) {
          console.error('Failed to send interim LINE message:', lineError);
        }
      }

      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          retryCount: currentRetryCount + 1,
          totalFound: partialCount,
        },
      });
      console.log(
        `[processNextJob] Job ${job.id} -> pending for retry ` +
        `(${currentRetryCount + 1}/${MAX_RETRY}). collected: ${partialCount}件`
      );
    } else {
      // リトライ上限超過: failed にする
      const previousCount = job.totalFound ?? 0;
      const additionalCount = partialCount - previousCount;

      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          totalFound: partialCount,
        },
      });

      // キーワード提案を生成
      let keywordSuggestion = '';
      try {
        const suggestions = await suggestAlternativeKeywords(job.keyword);
        if (suggestions.length > 0) {
          keywordSuggestion = '\n\n以下のキーワードで追加収集できる可能性があります：\n' +
            suggestions.map(s => `・${s}`).join('\n');
        }
      } catch (e) {
        console.error('Failed to generate keyword suggestions:', e);
      }

      // LINE通知（収集済み件数に応じてメッセージを変える）
      try {
        const autolistUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
        const loginUrl = `${autolistUrl}/login?lineUserId=${job.user.lineUserId}&callbackUrl=/my-lists`;

        let errorMessage: string;
        if (partialCount > 0) {
          errorMessage = additionalCount > 0
            ? `📋 「${job.keyword}」の追加収集が完了しました。\n\n` +
              `さらに${additionalCount}件収集できました。合計${partialCount}件になりました。\n\n` +
              `これ以上の収集が難しいため、こちらが最終結果となります。\n` +
              `リストはこちらから確認できます：\n${loginUrl}\n\n` +
              `クレジットはリスト確定時に実績分のみ課金されます。${keywordSuggestion}`
            : `📋 「${job.keyword}」の追加収集を試みましたが、これ以上見つかりませんでした。\n\n` +
              `最終結果は${partialCount}件です。\n` +
              `リストはこちらから確認できます：\n${loginUrl}\n\n` +
              `クレジットはリスト確定時に実績分のみ課金されます。${keywordSuggestion}`;
        } else {
          errorMessage = `申し訳ありません。「${job.keyword}」の収集を試みましたが、条件に合う企業が見つかりませんでした。\n\n` +
            `クレジットは消費されていません。${keywordSuggestion}\n\n` +
            `別のキーワードで再度お試しください。`;
        }

        await sendMessage(job.user.lineUserId, errorMessage);
      } catch (lineError) {
        console.error('Failed to send error message via LINE:', lineError);
      }

      console.log(
        `[processNextJob] Job ${job.id} -> failed (exceeded ${MAX_RETRY} retries, collected: ${partialCount}件)`
      );
    }

    // エラーをre-throwしない: processAllPendingJobsのwhileループが継続できるようにする
    return { processed: true, jobId: job.id };
  }
}

/**
 * 全てのpendingジョブを処理する（バッチ処理用）
 */
export async function processAllPendingJobs(): Promise<number> {
  let processedCount = 0;

  while (true) {
    const result = await processNextJob();
    if (!result.processed) {
      break;
    }
    processedCount++;

    // 連続処理の場合は少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return processedCount;
}
