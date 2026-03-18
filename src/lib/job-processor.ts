import { prisma } from './prisma';
import { collectUrlsWithQueries } from './collect-urls';
import { sendMessage } from './line';
import { analyzeQuery } from './analyze-query';
import { importJobToShiryolog } from './import-to-shiryolog';
import { sendJobCompletedEmail } from './mailer';
import { getAdjacentPrefectures } from './adjacent-prefectures';

/**
 * pendingのジョブを1件取得して処理する
 */
export async function processNextJob(): Promise<{ processed: boolean; jobId?: string }> {
  // pendingのジョブを1件取得（古い順）
  const job = await prisma.listJob.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    include: { user: true },
  });

  if (!job) {
    return { processed: false };
  }

  console.log(`Processing job: ${job.id}, keyword: ${job.keyword}`);

  // ジョブをrunningに更新
  await prisma.listJob.update({
    where: { id: job.id },
    data: { status: 'running', progress: 0 },
  });

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

    // URL収集を実行
    const { totalFound, scrapedCount } = await collectUrlsWithQueries(
      job.id,
      analyzed.searchQueries,
      job.targetCount,
      job.userId,
      job.industry ?? null,
      job.location ?? null,
      industryKeywords
    );

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

    // ジョブをfailedに更新
    await prisma.listJob.update({
      where: { id: job.id },
      data: { status: 'failed' },
    });

    // エラーをLINEで通知
    try {
      const errorMessage = `❌ リスト収集に失敗しました

もう一度お試しください。
問題が続く場合はサポートにお問い合わせください。`;

      await sendMessage(job.user.lineUserId, errorMessage);
    } catch (lineError) {
      console.error('Failed to send error message via LINE:', lineError);
    }

    throw error;
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
