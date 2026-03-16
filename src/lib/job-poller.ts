/**
 * ジョブポーリング・自動復旧モジュール
 *
 * 1. サーバー起動時: running ジョブを pending にリセット → pending ジョブを処理開始
 * 2. 2分おきのポーリング: pending ジョブチェック + スタックジョブ検知
 * 3. 30分以上スタックした running ジョブを failed 化 + クレジット返却 + LINE通知
 */

import { prisma } from './prisma';
import { sendMessage } from './line';
import { processAllPendingJobs } from './job-processor';

let isProcessing = false;

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
async function startProcessingIfNeeded() {
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
 * 対策3: 30分以上スタックした running ジョブを failed 化 + クレジット返却 + LINE通知
 */
async function handleStuckJobs() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const stuckJobs = await prisma.listJob.findMany({
    where: {
      status: 'running',
      updatedAt: { lt: thirtyMinutesAgo },
    },
    include: { user: true },
  });

  if (stuckJobs.length === 0) {
    return;
  }

  console.log(`[JobPoller] Found ${stuckJobs.length} stuck job(s) (running > 30min)`);

  for (const job of stuckJobs) {
    try {
      // ジョブを failed に更新
      await prisma.listJob.update({
        where: { id: job.id },
        data: { status: 'failed' },
      });

      // B案: 完了時実績ベース課金のため、スタック時のクレジット返却は不要

      // LINE通知
      try {
        await sendMessage(
          job.user.lineUserId,
          `⚠️ 収集中にエラーが発生しました。\n\n` +
          `依頼: ${job.keyword}\n` +
          `クレジットは消費されていません。\n\n` +
          `お手数ですが再度依頼してください。`
        );
      } catch (lineError) {
        console.error(`[JobPoller] Failed to send LINE notification for job ${job.id}:`, lineError);
      }

      console.log(`[JobPoller] Stuck job ${job.id} marked as failed (no credits charged, B案)`);
    } catch (error) {
      console.error(`[JobPoller] Error handling stuck job ${job.id}:`, error);
    }
  }
}
