import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, replyMessage } from '@/lib/line';
import { analyzeQuery, checkAmbiguousLocation } from '@/lib/analyze-query';
import { prisma } from '@/lib/prisma';
import { startProcessingIfNeeded } from '@/lib/job-poller';
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
  postback?: {
    data: string;
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

const ADMIN_LINE_USER_ID = 'Udf97fe475b4c6e2bcdf987599cf80b14';

/**
 * LINEプッシュメッセージを送信する
 */
async function pushMessage(to: string, text: string): Promise<void> {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
    }),
  });
}

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

const WELCOME_MESSAGE = `👋 友だち登録ありがとうございます！

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
    // 友だち追加イベントの処理
    if (event.type === 'follow') {
      if (event.replyToken) {
        const lineUserId = event.source.userId;
        const existingUser = lineUserId ? await prisma.lineUser.findUnique({ where: { lineUserId } }) : null;
        if (existingUser) {
          await replyMessage(event.replyToken, `おかえりなさい！👋\n\nオートリストをまたご利用いただきありがとうございます。\n\n💳 残りクレジット: ${existingUser.credits}件\n\nさっそく依頼してみてください！\n例: 「渋谷区の不動産会社 30件」`);
        } else {
          await replyMessage(event.replyToken, WELCOME_MESSAGE);
        }
      }
      continue;
    }

    // postbackイベントの処理
    if (event.type === 'postback') {
      const lineUserId = event.source.userId;
      const replyToken = event.replyToken;
      const data = new URLSearchParams(event.postback?.data || '');
      const action = data.get('action');

      // ユーザーを取得または作成
      let pbUser = await prisma.lineUser.findUnique({ where: { lineUserId } });
      if (!pbUser) {
        pbUser = await prisma.lineUser.create({
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

      switch (action) {
        case 'new_request':
          if (replyToken) {
            await replyMessage(replyToken, '業種と地域を送ってください。\n例：「渋谷区の不動産会社30件」');
          }
          break;

        case 'check_credits':
          if (replyToken) {
            await replyMessage(replyToken, `💳 残クレジット: ${pbUser.credits}件`);
          }
          break;

        case 'charge': {
          // stateをawaiting_chargeに更新してチャージ案内
          await prisma.lineUser.update({
            where: { id: pbUser.id },
            data: { state: 'awaiting_charge' },
          });
          const credits = pbUser.credits ?? 0;
          const pricingMessage = `チャージするプランを選んでください：\n\n1️⃣ ¥2,000 → 100件（20円/件）\n2️⃣ ¥5,000 → 300件（17円/件）★人気\n3️⃣ ¥10,000 → 700件（14円/件）\n4️⃣ ¥15,000 → 1,500件（10円/件）\n\n番号を送信してください。`;
          const chargeReplyText = credits <= 0
            ? `💳 無料枠（100件）を使い切りました。\n続けてご利用いただくにはチャージが必要です。\n\n${pricingMessage}`
            : `💳 現在の残クレジット: ${credits}件\n\nさらにチャージすることもできます。\n\n${pricingMessage}`;
          if (replyToken) {
            await replyMessage(replyToken, chargeReplyText);
          }
          break;
        }

        case 'help':
          if (replyToken) {
            await replyMessage(replyToken, `📋 オートリストの使い方\n\n1️⃣ 業種と地域をLINEに送る\n例：「渋谷区の不動産会社30件」\n\n2️⃣ 確認メッセージが届く\n\n3️⃣「はい」で収集開始\n\n4️⃣ 完了したらLINEに通知\n\n❓ 困ったことがあれば「問い合わせ」ボタンへ`);
          }
          break;

        case 'contact':
          if (replyToken) {
            await replyMessage(replyToken, '📞 問い合わせを受け付けました。\nスタッフより折り返しご連絡いたします。');
          }
          await pushMessage(
            ADMIN_LINE_USER_ID,
            `🔔 問い合わせが来ました！\n\nユーザー: ${pbUser.displayName || '未設定'}\nLINE ID: ${pbUser.lineUserId}\n\nLINEで返信してください。`
          );
          break;

        default:
          if (replyToken) {
            await replyMessage(replyToken, 'メニューから操作してください。');
          }
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

      // creditsが残っているのにawaiting_chargeのままの場合はリセット
      if (user.credits > 0 && user.state === 'awaiting_charge') {
        await prisma.lineUser.update({
          where: { id: user.id },
          data: { state: 'idle' }
        });
        user.state = 'idle';
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
      let skipConfirmationBlock = false;
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

            // ジョブ作成 + クレジット仮押さえ（トランザクション）
            const reservedCredits = pendingState.targetCount;
            const [job] = await prisma.$transaction([
              prisma.listJob.create({
                data: {
                  userId: user.id,
                  keyword: pendingState.keyword,
                  industry: pendingState.industry,
                  location: pendingState.location,
                  targetCount: pendingState.targetCount,
                  reservedCredits: reservedCredits,
                  status: 'pending',
                  originalMessage: pendingState.originalMessage,
                  industryKeywords: pendingState.industryKeywords || [],
                },
              }),
              prisma.lineUser.update({
                where: { id: user.id },
                data: {
                  credits: { decrement: reservedCredits },
                },
              }),
            ]);

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

            // クレジット仮押さえ済み（完了時に差分返却）
            const remainingAfterReserve = user.credits - reservedCredits;

            const isShiryologUser = !!user.userId;
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
            const acceptanceMessage = isShiryologUser
              ? `✅ リスト収集を開始します！

条件:
・業種: ${pendingState.industry || '指定なし'}
・地域: ${pendingState.location || '指定なし'}
・件数: ${pendingState.targetCount}社

💳 ${reservedCredits}クレジット仮押さえ → 残り${remainingAfterReserve}クレジット
（収集できた分だけ消費、残りは返却）

完了後はこちらでご確認ください👇
${appUrl}/my-lists`
              : `✅ リスト収集を開始します！

条件:
・業種: ${pendingState.industry || '指定なし'}
・地域: ${pendingState.location || '指定なし'}
・件数: ${pendingState.targetCount}社

💳 ${reservedCredits}クレジット仮押さえ → 残り${remainingAfterReserve}クレジット
（収集できた分だけ消費、残りは返却）

完了したらLINEでお知らせします。`;

            if (replyToken) {
              await replyMessage(replyToken, acceptanceMessage);
            }

            console.log(`Job created: ${job.id} for user: ${lineUserId}`);

            // ジョブ処理起動: ポーラーのstartProcessingIfNeededを直接呼ぶ
            // isProcessingガードが効くため、既に処理中なら何もしない（二重処理防止）
            startProcessingIfNeeded().catch(error => {
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
例: 「渋谷区の不動産会社30件」`);
            }

          } else {
            // 件数変更の検出
            const countMatch = answer.match(/^(\d+)件?(?:に変更)?$/);
            if (countMatch) {
              const newCount = parseInt(countMatch[1], 10);

              // バリデーション（10件単位、10〜100件）
              if (newCount < 10 || newCount % 10 !== 0 || newCount > 100) {
                if (replyToken) {
                  await replyMessage(replyToken, `❌ 件数は10〜100件の範囲で、10件単位で指定してください。\n\n例: 「50件に変更」`);
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
              const updatedConfirmMessageObj = {
                type: 'text',
                text: `以下の条件でリストを収集してよいですか？\n\n🏢 業種：${pendingState.industry || '指定なし'}\n📍 地域：${pendingState.location || '指定なし'}\n📊 件数：${newCount}社\n\n💳 最大${newCount}クレジット消費予定（開始時に仮押さえ、未使用分は返却）`,
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '🚀 収集スタート',
                        text: 'はい',
                      },
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: 'キャンセル',
                        text: 'いいえ',
                      },
                    },
                  ],
                },
              };

              if (replyToken) {
                await replyMessage(replyToken, updatedConfirmMessageObj);
              }
              continue;
            }

            // 「はい」「いいえ」以外 → 新しい依頼として処理する
            await prisma.lineUser.update({
              where: { id: user.id },
              data: { state: null },
            });
            user.state = null;
            skipConfirmationBlock = true;
          }

          if (!skipConfirmationBlock) {
            continue;
          }
        }
      }

      // --- 不足情報待ち状態の処理 ---
      if (user.state?.startsWith('{') && !skipConfirmationBlock) {
        try {
          const pendingState = JSON.parse(user.state);

          if (pendingState.status === 'awaiting_query_info') {
            const answer = messageText.trim();

            // キャンセル処理
            if (answer === 'キャンセル' || answer === 'cancel' || answer === 'CANCEL') {
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: null },
              });
              if (replyToken) {
                await replyMessage(replyToken, `❌ キャンセルしました。\n\n別の条件で試す場合は、改めてメッセージを送ってください。\n例: 「渋谷区の不動産会社30件」`);
              }
              continue;
            }

            // ユーザーの追加情報をGeminiで解析
            const supplementAnalyzed = await analyzeQuery(answer);

            // 前回の解析結果と組み合わせ
            const mergedIndustry = pendingState.missingFields.includes('industry') && supplementAnalyzed.industrySpecified
              ? supplementAnalyzed.industry
              : (pendingState.industry || supplementAnalyzed.industry);
            const mergedLocation = pendingState.missingFields.includes('location') && supplementAnalyzed.locationSpecified
              ? supplementAnalyzed.location
              : (pendingState.location || supplementAnalyzed.location);
            const mergedCount = pendingState.missingFields.includes('count') && supplementAnalyzed.countSpecified
              ? supplementAnalyzed.targetCount
              : (pendingState.targetCount || supplementAnalyzed.targetCount);
            const mergedIndustryKeywords = supplementAnalyzed.industrySpecified && supplementAnalyzed.industryKeywords.length > 0
              ? supplementAnalyzed.industryKeywords
              : (pendingState.industryKeywords.length > 0 ? pendingState.industryKeywords : supplementAnalyzed.industryKeywords);

            // 海外地域チェック
            if (supplementAnalyzed.locationSpecified && !supplementAnalyzed.isDomestic) {
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: null },
              });
              if (replyToken) {
                await replyMessage(replyToken, '申し訳ございません。現在は日本国内の地域のみ対応しています。');
              }
              continue;
            }

            // まだ不足している情報があるかチェック
            const stillMissing: string[] = [];
            if (!mergedIndustry) stillMissing.push('industry');
            if (!mergedLocation) stillMissing.push('location');
            if (!mergedCount || mergedCount <= 0) stillMissing.push('count');

            if (stillMissing.length > 0) {
              // まだ不足 → stateを更新して再度質問
              const updatedPendingState = JSON.stringify({
                status: 'awaiting_query_info',
                industry: mergedIndustry || '',
                location: mergedLocation || '',
                targetCount: mergedCount || 0,
                industryKeywords: mergedIndustryKeywords || [],
                searchQueries: supplementAnalyzed.searchQueries.length > 0 ? supplementAnalyzed.searchQueries : pendingState.searchQueries || [],
                originalMessage: pendingState.originalMessage,
                missingFields: stillMissing,
              });

              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: updatedPendingState },
              });

              const questions: string[] = [];
              if (stillMissing.includes('industry')) {
                questions.push('🏢 業種：どの業種で収集しますか？\n   例：IT企業、歯科医院、不動産会社');
              }
              if (stillMissing.includes('location')) {
                questions.push('📍 地域：どの地域で収集しますか？\n   例：渋谷区、大阪市、福岡県');
              }
              if (stillMissing.includes('count')) {
                questions.push('📊 件数：何件収集しますか？（10件単位、最大100件）');
              }

              let questionMessage: string;
              if (questions.length === 1) {
                questionMessage = questions[0].replace(/^[^\s]+\s/, '');
              }  else {
                questionMessage = `まだ以下の情報が不足しています。\n\n${questions.join('\n\n')}`;
              }

              if (replyToken) {
                await replyMessage(replyToken, questionMessage);
              }
              continue;
            }

            // 全情報が揃った → stateをクリアして通常フローへ
            await prisma.lineUser.update({
              where: { id: user.id },
              data: { state: null },
            });
            user.state = null;

            // 曖昧な地域名チェック
            const ambiguousWardCheck = checkAmbiguousLocation(mergedLocation);
            if (ambiguousWardCheck) {
              // 地域だけ不足として再度質問
              const reaskState = JSON.stringify({
                status: 'awaiting_query_info',
                industry: mergedIndustry,
                location: '',
                targetCount: mergedCount,
                industryKeywords: mergedIndustryKeywords,
                searchQueries: [],
                originalMessage: pendingState.originalMessage,
                missingFields: ['location'],
              });
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: reaskState },
              });
              if (replyToken) {
                await replyMessage(replyToken, `⚠️ 「${ambiguousWardCheck}」は全国に複数あります。\n\n都道府県や市も含めて指定してください。\n\n例: 「大阪市西区」「横浜市西区」「名古屋市港区」`);
              }
              continue;
            }

            // targetCountバリデーション
            if (mergedCount < 10) {
              const reaskState = JSON.stringify({
                status: 'awaiting_query_info',
                industry: mergedIndustry,
                location: mergedLocation,
                targetCount: 0,
                industryKeywords: mergedIndustryKeywords,
                searchQueries: [],
                originalMessage: pendingState.originalMessage,
                missingFields: ['count'],
              });
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: reaskState },
              });
              if (replyToken) {
                await replyMessage(replyToken, `❌ 10件以上からご利用いただけます。\n10、20、30社など、10件単位でご指定ください。`);
              }
              continue;
            }
            if (mergedCount % 10 !== 0) {
              const reaskState = JSON.stringify({
                status: 'awaiting_query_info',
                industry: mergedIndustry,
                location: mergedLocation,
                targetCount: 0,
                industryKeywords: mergedIndustryKeywords,
                searchQueries: [],
                originalMessage: pendingState.originalMessage,
                missingFields: ['count'],
              });
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: reaskState },
              });
              if (replyToken) {
                await replyMessage(replyToken, `❌ 件数は10件単位でご指定ください。\n（例：10、20、30、50社）`);
              }
              continue;
            }
            if (mergedCount > 100) {
              const reaskState = JSON.stringify({
                status: 'awaiting_query_info',
                industry: mergedIndustry,
                location: mergedLocation,
                targetCount: 0,
                industryKeywords: mergedIndustryKeywords,
                searchQueries: [],
                originalMessage: pendingState.originalMessage,
                missingFields: ['count'],
              });
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: reaskState },
              });
              if (replyToken) {
                await replyMessage(replyToken, `❌ 一度に依頼できるのは最大100件までです。件数を減らして再度ご依頼ください。`);
              }
              continue;
            }

            // クレジット残量チェック
            if (user.credits < mergedCount) {
              await prisma.lineUser.update({
                where: { id: user.id },
                data: { state: null },
              });
              const warningMessage = `⚠️ クレジットが不足しています。\n\n残クレジット: ${user.credits}件\n依頼件数: ${mergedCount}件\n\n残クレジット分（${user.credits}件）で実行するか、チャージしてから依頼してください。\n\nチャージする場合は「チャージ」と送信してください。\nこのまま続ける場合は「${user.credits}件で実行」と送信してください。`;
              if (replyToken) {
                await replyMessage(replyToken, warningMessage);
              }
              continue;
            }

            // searchQueriesを再生成（mergedの情報で）
            const finalSearchQueries = [
              `${mergedIndustry} ${mergedLocation} お問い合わせ`,
              `${mergedIndustry} ${mergedLocation} 会社概要`,
              ...(mergedIndustryKeywords.length > 0
                ? [`${mergedIndustryKeywords.join(' ')} ${mergedLocation} 企業一覧`]
                : []),
              `${mergedIndustry} ${mergedLocation} contact`,
            ];

            // 確認メッセージ送信
            const mergedConfirmState = JSON.stringify({
              status: 'awaiting_confirmation',
              keyword: `${mergedIndustry} ${mergedLocation} ${mergedCount}件`,
              industry: mergedIndustry,
              location: mergedLocation,
              targetCount: mergedCount,
              originalMessage: pendingState.originalMessage,
              industryKeywords: mergedIndustryKeywords,
            });

            await prisma.lineUser.update({
              where: { id: user.id },
              data: { state: mergedConfirmState },
            });

            const mergedConfirmMsg = {
              type: 'text',
              text: `以下の条件でリストを収集してよいですか？\n\n🏢 業種：${mergedIndustry}\n📍 地域：${mergedLocation}\n📊 件数：${mergedCount}社\n\n💳 最大${mergedCount}クレジット消費予定（開始時に仮押さえ、未使用分は返却）`,
              quickReply: {
                items: [
                  {
                    type: 'action',
                    action: {
                      type: 'message',
                      label: '🚀 収集スタート',
                      text: 'はい',
                    },
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'message',
                      label: 'キャンセル',
                      text: 'いいえ',
                    },
                  },
                ],
              },
            };

            if (replyToken) {
              await replyMessage(replyToken, mergedConfirmMsg);
            }
            continue;
          }
        } catch (parseError) {
          // JSONパースに失敗した場合はstateをリセットして通常フローへ
          console.error('Failed to parse pending query state:', parseError);
          await prisma.lineUser.update({
            where: { id: user.id },
            data: { state: null },
          });
          user.state = null;
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

      // --- 海外地域の拒否 ---
      if (analyzed.locationSpecified && !analyzed.isDomestic) {
        if (replyToken) {
          await replyMessage(replyToken, '申し訳ございません。現在は日本国内の地域のみ対応しています。');
        }
        continue;
      }

      // --- 不足情報の質問 ---
      const missingFields: string[] = [];
      if (!analyzed.industrySpecified) missingFields.push('industry');
      if (!analyzed.locationSpecified) missingFields.push('location');
      if (!analyzed.countSpecified) missingFields.push('count');

      if (missingFields.length > 0) {
        // 不足情報がある場合、pendingQueryとして保存して質問
        const pendingQueryState = JSON.stringify({
          status: 'awaiting_query_info',
          industry: analyzed.industry || '',
          location: analyzed.location || '',
          targetCount: analyzed.targetCount || 0,
          industryKeywords: analyzed.industryKeywords || [],
          searchQueries: analyzed.searchQueries || [],
          originalMessage: messageText,
          missingFields,
        });

        await prisma.lineUser.update({
          where: { id: user.id },
          data: { state: pendingQueryState },
        });

        // 不足情報に応じた質問メッセージを組み立て
        const questions: string[] = [];
        if (missingFields.includes('industry')) {
          questions.push('🏢 業種：どの業種で収集しますか？\n   例：IT企業、歯科医院、不動産会社');
        }
        if (missingFields.includes('location')) {
          questions.push('📍 地域：どの地域で収集しますか？\n   例：渋谷区、大阪市、福岡県');
        }
        if (missingFields.includes('count')) {
          questions.push('📊 件数：何件収集しますか？（10件単位、最大100件）');
        }

        let questionMessage: string;
        if (questions.length === 1) {
          questionMessage = questions[0].replace(/^[^\s]+\s/, '');
        } else {
          questionMessage = `以下の情報が不足しています。\n\n${questions.join('\n\n')}`;
        }

        if (replyToken) {
          await replyMessage(replyToken, questionMessage);
        }
        continue;
      }

      // 曖昧な地域名チェック
      const ambiguousWard = checkAmbiguousLocation(analyzed.location);
      if (ambiguousWard) {
        if (replyToken) {
          await replyMessage(replyToken, `⚠️ 「${ambiguousWard}」は全国に複数あります。\n\n都道府県や市も含めて指定してください。\n\n例: 「大阪市西区」「横浜市西区」「名古屋市港区」`);
        }
        continue;
      }

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
      if (analyzed.targetCount > 100) {
        if (replyToken) {
          await replyMessage(replyToken, `❌ 一度に依頼できるのは最大100件までです。件数を減らして再度ご依頼ください。`);
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
        originalMessage: messageText,
        industryKeywords: analyzed.industryKeywords || [],
      });

      await prisma.lineUser.update({
        where: { id: user.id },
        data: { state: confirmationState },
      });

      const remainingAfter = user.credits - analyzed.targetCount;
      const confirmMessageObj = {
        type: 'text',
        text: `以下の条件でリストを収集してよいですか？\n\n🏢 業種：${analyzed.industry || '指定なし'}\n📍 地域：${analyzed.location || '指定なし'}\n📊 件数：${analyzed.targetCount}社\n\n💳 最大${analyzed.targetCount}クレジット消費予定（開始時に仮押さえ、未使用分は返却）`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'message',
                label: '🚀 収集スタート',
                text: 'はい',
              },
            },
            {
              type: 'action',
              action: {
                type: 'message',
                label: 'キャンセル',
                text: 'いいえ',
              },
            },
          ],
        },
      };

      if (replyToken) {
        await replyMessage(replyToken, confirmMessageObj);
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
