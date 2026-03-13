import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, replyMessage } from '@/lib/line';
import { analyzeQuery } from '@/lib/analyze-query';
import { prisma } from '@/lib/prisma';

interface LineEvent {
  type: string;
  replyToken?: string;
  source: {
    userId: string;
    type: string;
  };
  message?: {
    type: string;
    text: string;
  };
}

interface LineWebhookBody {
  events: LineEvent[];
  destination: string;
}

const HELP_COMMANDS = ['ヘルプ', 'help', 'ヘルプ！', 'HELP', '使い方', '?', '？'];

const HELP_MESSAGE = `📋 オートリスト の使い方

メッセージ例:
・「IT企業 東京 100社」
・「飲食店 大阪 50社リストして」
・「製造業 愛知県 200社お願い」

業種・地域・件数を自由に指定できます。
収集完了後、シリョログでフォーム送信できます。

無料プラン: 月100社まで`;

/**
 * POST /api/webhook
 * LINE Webhookエンドポイント
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature') || '';

    // 署名検証
    const isValid = await verifySignature(body, signature);
    if (!isValid) {
      console.error('Invalid LINE signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookBody: LineWebhookBody = JSON.parse(body);

    // イベントを非同期で処理（レスポンスを早く返すため）
    handleEvents(webhookBody.events).catch(error => {
      console.error('Error handling LINE events:', error);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * LINEイベントを処理する
 */
async function handleEvents(events: LineEvent[]): Promise<void> {
  for (const event of events) {
    if (event.type !== 'message' || event.message?.type !== 'text') {
      continue;
    }

    const lineUserId = event.source.userId;
    const messageText = event.message.text.trim();
    const replyToken = event.replyToken;

    try {
      // ヘルプコマンドの処理
      if (HELP_COMMANDS.includes(messageText.toLowerCase())) {
        if (replyToken) {
          await replyMessage(replyToken, HELP_MESSAGE);
        }
        continue;
      }

      // ユーザーを取得または作成
      let user = await prisma.user.findUnique({
        where: { lineUserId },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            lineUserId,
            displayName: null,
            plan: 'free',
            monthlyCount: 0,
          },
        });
      }

      // 月次制限チェック（無料プランは月100社まで）
      if (user.plan === 'free' && user.monthlyCount >= 100) {
        const limitMessage = `⚠️ 今月の無料枠（100社）に達しました。

プランをアップグレードすると、より多くの企業リストを収集できます。`;
        if (replyToken) {
          await replyMessage(replyToken, limitMessage);
        }
        continue;
      }

      // Claude APIでクエリを解析
      const analyzed = await analyzeQuery(messageText);

      // ジョブを作成
      const job = await prisma.listJob.create({
        data: {
          userId: user.id,
          keyword: messageText,
          industry: analyzed.industry,
          location: analyzed.location,
          targetCount: analyzed.targetCount,
          status: 'pending',
        },
      });

      // 受付メッセージを送信
      const acceptanceMessage = `✅ リスト収集を開始します！

条件:
・業種: ${analyzed.industry}
・地域: ${analyzed.location}
・件数: ${analyzed.targetCount}社

各企業サイトのクロールとフォームの有無確認を行うため、完了まで1〜2時間ほどかかります。
完了したらLINEでお知らせしますので、他の作業をしていてください！`;

      if (replyToken) {
        await replyMessage(replyToken, acceptanceMessage);
      }

      console.log(`Job created: ${job.id} for user: ${lineUserId}`);

      // バックグラウンドでジョブ処理APIを呼び出す
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
      fetch(`${appUrl}/api/process-jobs`, {
        method: 'GET',
      }).catch(error => {
        console.error('Failed to trigger job processing:', error);
      });
    } catch (error) {
      console.error(`Error processing message from ${lineUserId}:`, error);

      // エラーメッセージを送信
      const errorMessage = `申し訳ありません。処理中にエラーが発生しました。

もう一度お試しいただくか、「ヘルプ」と送信して使い方を確認してください。`;

      try {
        if (replyToken) {
          await replyMessage(replyToken, errorMessage);
        }
      } catch (lineError) {
        console.error('Failed to send error message:', lineError);
      }
    }
  }
}

/**
 * GET /api/webhook
 * Webhookの動作確認用
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    message: 'Autolist LINE Webhook is running',
    timestamp: new Date().toISOString(),
  });
}
