import { prisma } from './prisma';
import { prismaShiryolog } from './prisma-shiryolog';
import { collectUrlsWithQueries } from './collect-urls';
import { sendMessage } from './line';
import { analyzeQuery } from './analyze-query';
import { importJobToShiryolog } from './import-to-shiryolog';
import { sendJobCompletedEmail } from './mailer';
import { suggestAlternativeKeywords } from './suggest-keywords';

/**
 * LineUser から lineUserId を取得するヘルパー
 * job.userId は User.id なので、LineUser.userId で逆引きする
 */
async function getLineUserIdForUser(userId: string): Promise<string | null> {
  const lineUser = await prisma.lineUser.findFirst({
    where: { userId },
    select: { lineUserId: true },
  });
  return lineUser?.lineUserId ?? null;
}

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
  let job: Awaited<ReturnType<typeof prisma.listJob.findFirst>> = null;

  while (true) {
    // pendingのジョブを1件取得（古い順）
    const candidate = await prisma.listJob.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
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

  // job.userId は User.id
  const userId = job.userId;

  // LINE通知用の lineUserId を取得
  const lineUserId = await getLineUserIdForUser(userId);

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
      where: { jobId: job.id },
    });

    // 残り件数を計算（既に収集済み分を差し引く）
    const remainingCount = Math.max(0, job.targetCount - existingCollectedCount);

    if (existingCollectedCount > 0) {
      console.log(
        `[Job ${job.id}] リトライ途中再開: 既収集 ${existingCollectedCount} 件, ` +
        `残り ${remainingCount} 件を追加収集`
      );
    }

    // excludeTermsを検索クエリに適用（-keyword形式で付与）
    const excludeSuffix = (analyzed.excludeTerms ?? [])
      .map(term => `-"${term}"`)
      .join(' ');
    const searchQueriesWithExclusions = excludeSuffix
      ? analyzed.searchQueries.map(q => `${q} ${excludeSuffix}`)
      : analyzed.searchQueries;

    if (excludeSuffix) {
      console.log(`[Job ${job.id}] excludeTerms applied: ${analyzed.excludeTerms.join(', ')}`);
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
        searchQueriesWithExclusions,
        remainingCount,
        job.userId,
        job.industry ?? null,
        job.location ?? null,
        industryKeywords
      );
      totalFound = result.totalFound;
      scrapedCount = result.scrapedCount;
    }

    // 収集済み件数を取得（顧客提出用件数）
    const formCount = await prisma.collectedUrl.count({
      where: { jobId: job.id },
    });

    // 完了後のstatus確認（キャンセルされた場合は按分課金）
    const finalJob = await prisma.listJob.findUnique({
      where: { id: job.id },
      select: { status: true },
    });

    const autolistUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
    const targetCount = job.targetCount;
    const loginUrl = lineUserId
      ? `${autolistUrl}/login?lineUserId=${lineUserId}&callbackUrl=/my-lists&openExternalBrowser=1`
      : `${autolistUrl}/my-lists?openExternalBrowser=1`;

    if (finalJob?.status === 'cancelled') {
      // キャンセル：仮押さえ分から実績分を引いた差額を返却
      const actualCount = formCount;
      const reservedCredits = job.reservedCredits ?? 0;
      const refundCredits = Math.max(0, reservedCredits - actualCount);

      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          progress: Math.round((actualCount / targetCount) * 100),
          totalFound: actualCount,
          completedAt: new Date(),
          // status は 'cancelled' のまま変更しない
        },
      });

      // 仮押さえ済みのクレジットから差分を返却 + monthlyCount更新（User テーブル）
      if (refundCredits > 0 || actualCount > 0) {
        await prismaShiryolog.user.update({
          where: { id: userId },
          data: {
            autolistMonthlyCount: { increment: actualCount },
            autolistCredits: { increment: refundCredits },
          },
        });
      }

      // キャンセル完了通知
      const updatedUser = await prismaShiryolog.user.findUnique({
        where: { id: userId },
        select: { autolistCredits: true, name: true, email: true },
      });
      const remainingCredits = updatedUser?.autolistCredits ?? 0;

      if (updatedUser?.email) {
        // シリョログ登録済み → メール通知
        await sendJobCompletedEmail({
          to: updatedUser.email,
          userName: updatedUser.name || 'お客様',
          keyword: job.keyword,
          industry: job.industry,
          location: job.location,
          totalFound: actualCount,
          myListsUrl: `${autolistUrl}/my-lists`,
        });
      }

      if (lineUserId) {
        // LINE Push通知
        await sendMessage(lineUserId,
          `❌ リスト収集をキャンセルしました。\n\n` +
          `収集済み: ${actualCount}社\n` +
          `消費: ${actualCount}クレジット` + (refundCredits > 0 ? `（${refundCredits}クレジット返却）` : '') + `\n` +
          `💳 残クレジット: ${remainingCredits}件\n\n` +
          `収集済みのリストはこちらから確認できます 🔗\n` +
          loginUrl + '\n\n' +
          `📧 シリョログに登録するとメールで完了通知が届きます`
        );
      }

      console.log(`Job ${job.id} cancelled. Found ${actualCount} URLs, consumed ${actualCount} credits, refunded ${refundCredits} credits.`);

    } else {
      // 通常完了: ジョブをcompletedに更新 + 仮押さえ差分を返却
      const reservedCredits = job.reservedCredits ?? 0;
      const refundCredits = Math.max(0, reservedCredits - formCount);

      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          progress: 100,
          totalFound: formCount,
          completedAt: new Date(),
          confirmedAt: new Date(),
        },
      });

      // 仮押さえ差分を返却 + monthlyCount更新（User テーブル）
      const updateData: { autolistCredits?: { increment: number }; autolistMonthlyCount?: { increment: number } } = {};
      if (refundCredits > 0) {
        updateData.autolistCredits = { increment: refundCredits };
      }
      if (formCount > 0) {
        updateData.autolistMonthlyCount = { increment: formCount };
      }
      if (Object.keys(updateData).length > 0) {
        await prismaShiryolog.user.update({
          where: { id: userId },
          data: updateData,
        });
      }

      const updatedUser = await prismaShiryolog.user.findUnique({
        where: { id: userId },
        select: { autolistCredits: true, name: true, email: true },
      });
      if (!updatedUser) throw new Error('User not found');
      const remainingCreditsAfterCompletion = updatedUser.autolistCredits ?? 0;

      // ── 完了通知（メール + LINE依頼時のみLINE） ──
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';

      // 1. メール通知（全ユーザー共通）
      if (updatedUser.email) {
        await sendJobCompletedEmail({
          to: updatedUser.email,
          userName: updatedUser.name || 'お客様',
          keyword: job.keyword,
          industry: job.industry,
          location: job.location,
          totalFound: formCount,
          myListsUrl: `${appUrl}/my-lists`,
        });
      }

      // 2. LINE通知（LINE経由の依頼のみ — プッシュ通知コスト対策）
      if (job.source === 'line' && lineUserId) {
        const lineMessage = `✅ リストが完成しました！\n` +
          `📋 「${job.keyword}」${formCount}社の企業リストを収集しました\n` +
          `💳 ${formCount}クレジット使用 → 残り${remainingCreditsAfterCompletion}クレジット\n\n` +
          `リストを確認 🔗\n` +
          loginUrl;
        await sendMessage(lineUserId, lineMessage);
      }

      // ブラウザ通知はクライアント側ポーリング（JobList.tsx）で自動検知

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
      where: { jobId: job.id },
    });

    if (currentRetryCount < MAX_RETRY) {
      // リトライ可能

      // 収集済みが1件以上ある場合は中間通知を送信
      if (partialCount > 0 && lineUserId) {
        try {
          const autolistUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
          const retryLoginUrl = `${autolistUrl}/login?lineUserId=${lineUserId}&callbackUrl=/my-lists`;

          await sendMessage(lineUserId,
            `📋 「${job.keyword}」の収集状況をお知らせします。\n\n` +
            `現在${partialCount}件の企業を収集できました。\n` +
            `リストはこちらから確認できます：\n${retryLoginUrl}\n\n` +
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
      // リトライ上限超過: failed にする + 仮押さえ差分を返却
      const previousCount = job.totalFound ?? 0;
      const additionalCount = partialCount - previousCount;
      const reservedCreditsForFail = job.reservedCredits ?? 0;
      const refundCreditsForFail = Math.max(0, reservedCreditsForFail - partialCount);

      await prisma.listJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          totalFound: partialCount,
        },
      });

      // 仮押さえ差分を返却 + monthlyCount更新（User テーブル）
      if (refundCreditsForFail > 0 || partialCount > 0) {
        const failUpdateData: { autolistCredits?: { increment: number }; autolistMonthlyCount?: { increment: number } } = {};
        if (refundCreditsForFail > 0) {
          failUpdateData.autolistCredits = { increment: refundCreditsForFail };
        }
        if (partialCount > 0) {
          failUpdateData.autolistMonthlyCount = { increment: partialCount };
        }
        await prismaShiryolog.user.update({
          where: { id: userId },
          data: failUpdateData,
        });
      }

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
      if (lineUserId) {
        try {
          const autolistUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
          const failLoginUrl = `${autolistUrl}/login?lineUserId=${lineUserId}&callbackUrl=/my-lists`;

          let errorMessage: string;
          if (partialCount > 0) {
            errorMessage = additionalCount > 0
              ? `📋 「${job.keyword}」の追加収集が完了しました。\n\n` +
                `さらに${additionalCount}件収集できました。合計${partialCount}件になりました。\n\n` +
                `これ以上の収集が難しいため、こちらが最終結果となります。\n` +
                `リストはこちらから確認できます：\n${failLoginUrl}\n\n` +
                `除外した企業分のクレジットは返却されます。${keywordSuggestion}`
              : `📋 「${job.keyword}」の追加収集を試みましたが、これ以上見つかりませんでした。\n\n` +
                `最終結果は${partialCount}件です。\n` +
                `リストはこちらから確認できます：\n${failLoginUrl}\n\n` +
                `除外した企業分のクレジットは返却されます。${keywordSuggestion}`;
          } else {
            const updatedUserAfterFail = await prismaShiryolog.user.findUnique({
              where: { id: userId },
              select: { autolistCredits: true },
            });
            const remainingAfterFail = updatedUserAfterFail?.autolistCredits ?? 0;
            errorMessage = `申し訳ございません。「${job.keyword}」の条件で収集を試みましたが、問い合わせフォーム付きの企業が見つかりませんでした。\n\n` +
              `💳 仮押さえした${reservedCreditsForFail}クレジットは全額返却しました。\n残り${remainingAfterFail}クレジット` +
              `${keywordSuggestion}` +
              `\n\n別のキーワードで再度お試しください。`;
          }

          await sendMessage(lineUserId, errorMessage);
        } catch (lineError) {
          console.error('Failed to send error message via LINE:', lineError);
        }
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
