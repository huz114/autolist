import { prisma } from './prisma';
import { collectUrlsWithQueries } from './collect-urls';
import { sendMessage } from './line';
import { analyzeQuery } from './analyze-query';

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
      job.targetCount
    );

    // フォームありの件数を取得
    const formCount = await prisma.collectedUrl.count({
      where: { jobId: job.id, hasForm: true },
    });

    // ジョブをcompletedに更新
    await prisma.listJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: 100,
        totalFound,
        completedAt: new Date(),
      },
    });

    // ユーザーのmonthlyCountを更新
    await prisma.lineUser.update({
      where: { id: job.userId },
      data: {
        monthlyCount: {
          increment: totalFound,
        },
      },
    });

    // LINE完了通知を送信
    const shiryologUrl = process.env.SHIRYOLOG_API_URL || 'http://localhost:4002';
    const targetCount = job.targetCount;
    const completionMessage = formCount >= targetCount
      ? `✅ リストが完成しました！
📋 ${formCount}社のフォームあり企業リストを収集しました

シリョログで確認・送信できます 🔗
${shiryologUrl}/target-list`
      : `✅ リストが完成しました！
📋 ${formCount}社のフォームあり企業リストを収集しました
（目標${targetCount}社に対し、条件に合う企業が${formCount}社でした）

シリョログで確認・送信できます 🔗
${shiryologUrl}/target-list`;

    await sendMessage(job.user.lineUserId, completionMessage);

    console.log(`Job ${job.id} completed. Found ${totalFound} URLs.`);

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
