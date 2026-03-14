import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, replyMessage } from '@/lib/line';
import { analyzeQuery } from '@/lib/analyze-query';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

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

🎁 新規登録: 100件無料`;

const CHARGE_MESSAGE = `💳 無料枠（100件）を使い切りました。
続けてご利用いただくにはチャージが必要です。

チャージするプランを選んでください：

1️⃣ ¥2,000 → 100件（20円/件）
2️⃣ ¥5,000 → 300件（17円/件）★人気
3️⃣ ¥10,000 → 700件（14円/件）
4️⃣ ¥15,000 → 1,500件（10円/件）

番号を送信してください。`;

const CHARGE_PLANS = [
  { amount: 2000, credits: 100, label: '¥2,000 → 100件' },
  { amount: 5000, credits: 300, label: '¥5,000 → 300件' },
  { amount: 10000, credits: 700, label: '¥10,000 → 700件' },
  { amount: 15000, credits: 1500, label: '¥15,000 → 1,500件' },
];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

/**
 * Stripe Payment Linkを動的に生成する
 */
async function createPaymentLink(planIndex: number, lineUserId: string): Promise<string> {
  const plan = CHARGE_PLANS[planIndex];

  // Productを作成
  const product = await stripe.products.create({
    name: `オートリスト ${plan.label}`,
    metadata: {
      lineUserId,
      credits: String(plan.credits),
    },
  });

  // Priceを作成
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.amount,
    currency: 'jpy',
  });

  // Payment Linkを作成
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    metadata: {
      lineUserId,
      credits: String(plan.credits),
    },
    after_completion: {
      type: 'hosted_confirmation',
      hosted_confirmation: {
        custom_message: `チャージ完了しました！${plan.credits}件のクレジットが付与されます。LINEに戻って引き続きご利用ください。`,
      },
    },
  });

  return paymentLink.url;
}

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

const WELCOME_MESSAGE = `👋 友達登録ありがとうございます！

フォーム付き企業リストをLINEで
依頼するだけで自動収集します📋

🎁 最初の100件は無料でご利用いただけます。

━━━━━━━━━━━━━
📌 さっそく試してみてください！
↓こんな感じで送るだけ↓

「IT企業 東京 30社」
「美容サロン 大阪 20社」
━━━━━━━━━━━━━`;

/**
 * LINEイベントを処理する
 */
async function handleEvents(events: LineEvent[]): Promise<void> {
  for (const event of events) {
    // 友達追加イベントの処理
    if (event.type === 'follow') {
      if (event.replyToken) {
        await replyMessage(event.replyToken, WELCOME_MESSAGE);
      }
      continue;
    }

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
      let user = await prisma.lineUser.findUnique({
        where: { lineUserId },
      });

      if (!user) {
        user = await prisma.lineUser.create({
          data: {
            lineUserId,
            displayName: null,
            plan: 'free',
            monthlyCount: 0,
            credits: 100,
            state: null,
          },
        });
      }

      // --- 実行中キャンセルコマンドの処理 ---
      // awaiting_confirmation / awaiting_charge 以外の状態でキャンセルが送信された場合
      if (
        (messageText.trim() === 'キャンセル' || messageText.trim() === 'cancel') &&
        !user.state?.startsWith('{') &&
        user.state !== 'awaiting_charge'
      ) {
        // 処理中のジョブを探す
        const runningJob = await prisma.listJob.findFirst({
          where: {
            userId: user.id,
            status: 'running',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (runningJob) {
          // キャンセルフラグをセット
          await prisma.listJob.update({
            where: { id: runningJob.id },
            data: { status: 'cancelled' },
          });

          if (replyToken) {
            await replyMessage(replyToken,
              `⏳ キャンセルを受け付けました。\n\n処理を中断中です。完了したらお知らせします。\n（収集済み分のみ課金されます）`
            );
          }
        } else {
          if (replyToken) {
            await replyMessage(replyToken,
              `現在実行中のリスト収集はありません。`
            );
          }
        }
        continue;
      }

      // --- チャージ待ち状態の処理 ---
      if (user.state === 'awaiting_charge') {
        const planNumber = parseInt(messageText.trim(), 10);

        if (planNumber >= 1 && planNumber <= 4) {
          const planIndex = planNumber - 1;
          const plan = CHARGE_PLANS[planIndex];

          try {
            const paymentUrl = await createPaymentLink(planIndex, lineUserId);

            const paymentMessage = `✅ ${plan.label} を選択しました。

以下のリンクからお支払いください：
${paymentUrl}

お支払い完了後、自動的にクレジットが付与されます。`;

            if (replyToken) {
              await replyMessage(replyToken, paymentMessage);
            }
          } catch (stripeError) {
            console.error('Stripe error:', stripeError);
            if (replyToken) {
              await replyMessage(replyToken, `⚠️ 決済リンクの生成に失敗しました。しばらく後にもう一度お試しください。`);
            }
          }
        } else {
          // 無効な番号が来た場合は再度案内
          if (replyToken) {
            await replyMessage(replyToken, CHARGE_MESSAGE);
          }
        }
        continue;
      }

      // --- 確認待ち状態の処理 ---
      if (user.state?.startsWith('{')) {
        const pendingState = JSON.parse(user.state);

        if (pendingState.status === 'awaiting_confirmation') {
          const answer = messageText.trim();

          if (answer === 'はい' || answer === 'yes' || answer === 'YES' || answer === 'ハイ') {
            // state をクリア
            await prisma.lineUser.update({
              where: { id: user.id },
              data: { state: null },
            });

            // ジョブ作成
            const job = await prisma.listJob.create({
              data: {
                userId: user.id,
                keyword: pendingState.keyword,
                industry: pendingState.industry,
                location: pendingState.location,
                targetCount: pendingState.targetCount,
                status: 'pending',
              },
            });

            // SearchLog記録
            await prisma.searchLog.create({
              data: {
                userId: user.id,
                lineUserId: lineUserId,
                keyword: pendingState.keyword,
                industry: pendingState.industry,
                location: pendingState.location,
                targetCount: pendingState.targetCount,
                jobId: job.id,
              },
            });

            // クレジット消費
            await prisma.lineUser.update({
              where: { id: user.id },
              data: { credits: { decrement: pendingState.targetCount } },
            });

            const remainingAfterConfirm = user.credits - pendingState.targetCount;
            const acceptanceMessage = `✅ リスト収集を開始します！

条件:
・業種: ${pendingState.industry || '指定なし'}
・地域: ${pendingState.location || '指定なし'}
・件数: ${pendingState.targetCount}社

💳 残クレジット: ${user.credits}件 → ${remainingAfterConfirm}件

完了したらLINEでお知らせします。`;

            if (replyToken) {
              await replyMessage(replyToken, acceptanceMessage);
            }

            console.log(`Job created: ${job.id} for user: ${lineUserId}`);

            // ジョブ処理起動
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
            fetch(`${appUrl}/api/process-jobs`, {
              method: 'GET',
            }).catch(error => {
              console.error('Failed to trigger job processing:', error);
            });

          } else if (
            answer === 'いいえ' || answer === 'no' || answer === 'NO' ||
            answer === 'キャンセル' || answer === 'cancel' || answer === 'CANCEL'
          ) {
            // キャンセル
            await prisma.lineUser.update({
              where: { id: user.id },
              data: { state: null },
            });

            if (replyToken) {
              await replyMessage(replyToken, `❌ キャンセルしました。

別の条件で試す場合は、改めてメッセージを送ってください。
例: 「東京の歯科医院を100件」`);
            }

          } else {
            // 件数変更の検出
            const countMatch = answer.match(/^(\d+)件?(?:に変更)?$/);
            if (countMatch) {
              const newCount = parseInt(countMatch[1], 10);

              // バリデーション（10件単位、10〜500件）
              if (newCount < 10 || newCount % 10 !== 0 || newCount > 500) {
                if (replyToken) {
                  await replyMessage(replyToken, `❌ 件数は10〜500件の範囲で、10件単位で指定してください。\n\n例: 「50件に変更」`);
                }
                continue;
              }

              // クレジット残量チェック
              if (user.credits < newCount) {
                if (replyToken) {
                  await replyMessage(replyToken, `⚠️ クレジットが不足しています。\n残クレジット: ${user.credits}件\n\nチャージ後に再度お試しください。`);
                }
                continue;
              }

              // state の targetCount を更新して保存
              const updatedState = JSON.stringify({
                ...pendingState,
                targetCount: newCount,
              });
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: updatedState },
              });

              // 更新した確認メッセージを再送
              const remainingAfter = user.credits - newCount;
              const updatedConfirmMessage = `📋 件数を変更しました！

【収集条件】
・業種: ${pendingState.industry || '指定なし'}
・地域: ${pendingState.location || '指定なし'}
・件数: ${newCount}社（変更後）

💳 消費クレジット: ${newCount}件
残り: ${user.credits}件 → ${remainingAfter}件

✅ 収集開始 → 「はい」と送信
❌ キャンセル → 「いいえ」と送信`;

              if (replyToken) {
                await replyMessage(replyToken, updatedConfirmMessage);
              }
              continue;
            }

            // 「はい」「いいえ」以外
            if (replyToken) {
              await replyMessage(replyToken, `「はい」または「いいえ」と送信してください。

✅ 収集開始 → 「はい」
❌ キャンセル → 「いいえ」
🔢 件数変更 → 「50件に変更」`);
            }
          }

          continue;
        }
      }

      // --- クレジット残量チェック ---
      if (user.credits <= 0) {
        // stateをawaiting_chargeに更新
        await prisma.lineUser.update({
          where: { id: user.id },
          data: { state: 'awaiting_charge' },
        });

        if (replyToken) {
          await replyMessage(replyToken, CHARGE_MESSAGE);
        }
        continue;
      }

      // Claude APIでクエリを解析
      const analyzed = await analyzeQuery(messageText);

      // targetCount バリデーション
      if (analyzed.targetCount < 10) {
        if (replyToken) {
          await replyMessage(replyToken, `❌ 10件以上からご利用いただけます。\n10、20、30社など、10件単位でご指定ください。`);
        }
        continue;
      }
      if (analyzed.targetCount % 10 !== 0) {
        if (replyToken) {
          await replyMessage(replyToken, `❌ 件数は10件単位でご指定ください。\n（例：10、20、30、50社）`);
        }
        continue;
      }
      if (analyzed.targetCount > 500) {
        if (replyToken) {
          await replyMessage(replyToken, `❌ 一度に依頼できるのは最大500社までです。`);
        }
        continue;
      }

      // クレジット残量が依頼件数を下回る場合は警告
      if (user.credits < analyzed.targetCount) {
        const warningMessage = `⚠️ クレジットが不足しています。

残クレジット: ${user.credits}件
依頼件数: ${analyzed.targetCount}件

残クレジット分（${user.credits}件）で実行するか、チャージしてから依頼してください。

チャージする場合は「チャージ」と送信してください。
このまま続ける場合は「${user.credits}件で実行」と送信してください。`;
        if (replyToken) {
          await replyMessage(replyToken, warningMessage);
        }
        continue;
      }

      // 確認メッセージ送信 + state保存
      const confirmationState = JSON.stringify({
        status: 'awaiting_confirmation',
        keyword: messageText,
        industry: analyzed.industry,
        location: analyzed.location,
        targetCount: analyzed.targetCount,
      });

      await prisma.lineUser.update({
        where: { id: user.id },
        data: { state: confirmationState },
      });

      const remainingAfter = user.credits - analyzed.targetCount;
      const confirmMessage = `📋 リスト収集の確認

【収集条件】
・業種: ${analyzed.industry || '指定なし'}
・地域: ${analyzed.location || '指定なし'}
・件数: ${analyzed.targetCount}社

💳 消費クレジット: ${analyzed.targetCount}件
残り: ${user.credits}件 → ${remainingAfter}件

✅ 収集開始 → 「はい」と送信
❌ キャンセル → 「いいえ」と送信`;

      if (replyToken) {
        await replyMessage(replyToken, confirmMessage);
      }
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
