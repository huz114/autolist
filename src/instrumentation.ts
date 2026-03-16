/**
 * Next.js Instrumentation Hook
 * サーバー起動時に実行される処理:
 * 1. running ジョブを pending にリセット（途中再開用）
 * 2. pending ジョブがあれば処理を開始
 * 3. 2分おきのポーリングで pending ジョブをチェック
 * 4. 30分以上スタックした running ジョブを failed 化 + クレジット返却 + LINE通知
 */

export async function register() {
  // サーバーサイドのみで実行（Edge Runtimeでは実行しない）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid webpack bundling issues
    const { initJobPoller } = await import('./lib/job-poller');
    initJobPoller();
  }
}
