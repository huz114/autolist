import { NextRequest, NextResponse } from 'next/server';
import { processNextJob } from '@/lib/job-processor';

/**
 * GET /api/process-jobs
 * pendingのジョブを1件処理する
 * Vercel Cron または定期呼び出し用
 *
 * Vercel Cron設定例 (vercel.json):
 * {
 *   "crons": [
 *     {
 *       "path": "/api/process-jobs",
 *       "schedule": "* * * * *"
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Cronジョブからの認証（オプション）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // 本番環境では認証を必須にする
      // 開発環境ではスキップ
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const result = await processNextJob();

    if (!result.processed) {
      return NextResponse.json({
        success: true,
        message: 'No pending jobs',
        processed: false,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Job ${result.jobId} processed successfully`,
      processed: true,
      jobId: result.jobId,
    });
  } catch (error) {
    console.error('Error processing jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to process job',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/process-jobs
 * 複数ジョブを一括処理（管理者用）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('authorization');
    const adminSecret = process.env.ADMIN_SECRET;

    if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let processedCount = 0;
    const maxJobs = 5; // 一度に処理する最大ジョブ数

    for (let i = 0; i < maxJobs; i++) {
      const result = await processNextJob();
      if (!result.processed) break;
      processedCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} jobs`,
      processedCount,
    });
  } catch (error) {
    console.error('Error processing jobs:', error);
    return NextResponse.json(
      {
        error: 'Failed to process jobs',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
