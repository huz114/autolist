import { prisma } from './prisma';
import { collectUrlsWithQueries } from './collect-urls';
import { sendMessage } from './line';
import { analyzeQuery } from './analyze-query';
import { importJobToShiryolog } from './import-to-shiryolog';

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
        },
      });
    }

    // URL収集を実行
    const totalFound = await collectUrlsWithQueries(
      job.id,
      analyzed.searchQueries,
      job.targetCount,
      job.userId
    );

    // フォームありの件数を取得
    const formCount = await prisma.collectedUrl.count({
      where: { jobId: job.id, hasForm: true },
    });

    // 完了後のstatus確認（キャンセルされた場合は按分課金）
    const finalJob = await prisma.listJob.findUnique({
      where: { id: job.id },
      select: { status: true },
    });

    const autolistUrl = process.env.AUTOLIST_URL || 'http://localhost:3007';
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

      // LINE通知（キャンセル完了）
      const remainingCredits = job.user.credits - chargedCount;
      await sendMessage(job.user.lineUserId,
        `❌ リスト収集をキャンセルしました。\n\n` +
        `収集済み: ${actualCount}社\n` +
        `課金: ${chargedCount}件分\n` +
        `💳 残クレジット: ${remainingCredits}件\n\n` +
        `収集済みのリストはこちらから確認できます 🔗\n` +
        loginUrl
      );

      console.log(`Job ${job.id} cancelled. Found ${actualCount} URLs, charged ${chargedCount} credits.`);

    } else {
      // 通常完了: ジョブをcompletedに更新
      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          progress: 100,
          totalFound,
          completedAt: new Date(),
        },
      });

      // ユーザーのmonthlyCountを更新 & クレジット消費
      await prisma.lineUser.update({
        where: { id: job.userId },
        data: {
          monthlyCount: { increment: totalFound },
          credits: { decrement: formCount },
        },
      });

      // LINE完了通知を送信
      const completionMessage = formCount >= targetCount
        ? `✅ リストが完成しました！
📋 ${formCount}社のフォームあり企業リストを収集しました

ログインしてリストを確認・送信できます 🔗
${loginUrl}`
        : `✅ リストが完成しました！
📋 ${formCount}社のフォームあり企業リストを収集しました
（目標${targetCount}社に対し、条件に合う企業が${formCount}社でした）

ログインしてリストを確認・送信できます 🔗
${loginUrl}`;

      await sendMessage(job.user.lineUserId, completionMessage);

      // シリョログの Company テーブルに自動インポート
      try {
        const imported = await importJobToShiryolog(job.id);
        console.log(`Imported ${imported} companies to Shiryolog from job ${job.id}`);
      } catch (e) {
        console.error('Failed to import to Shiryolog:', e);
        // エラーでもジョブ完了処理は止めない
      }

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
