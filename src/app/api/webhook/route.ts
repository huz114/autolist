import { NextRequest, NextResponse } from 'next/server';
import { verifySignature, replyMessage } from '@/lib/line';
import { analyzeQuery, checkAmbiguousLocation } from '@/lib/analyze-query';
import { prisma } from '@/lib/prisma';
import { prismaShiryolog } from '@/lib/prisma-shiryolog';
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

const HELP_MESSAGE = `📋 オートリストの使い方

1️⃣ 業種・地域・件数をまとめてLINEに送る
   例：「不動産会社 渋谷区 30件」

2️⃣ 確認メッセージが届く → 「🚀 収集スタート」で開始

3️⃣ 完了したらLINEとメールでお知らせ
   → PCでリスト確認・CSVダウンロード

💰 最初の100件は無料！
   追加はメニューの「チャージ」から

❓ お困りの際はメニューの「問い合わせ」から`;

const CHARGE_QUICK_REPLY = {
  items: [
    {
      type: 'action' as const,
      action: { type: 'message' as const, label: '300件', text: '300件' },
    },
    {
      type: 'action' as const,
      action: { type: 'message' as const, label: '600件', text: '600件' },
    },
    {
      type: 'action' as const,
      action: { type: 'message' as const, label: '1,200件', text: '1,200件' },
    },
    {
      type: 'action' as const,
      action: { type: 'message' as const, label: '3,000件', text: '3,000件' },
    },
  ],
};

const CHARGE_PRICING_TEXT = `チャージするプランを選んでください：

1️⃣ ¥2,980 → 300件（9.9円/件）
2️⃣ ¥4,980 → 600件（8.3円/件）
3️⃣ ¥8,980 → 1,200件（7.5円/件）★人気
4️⃣ ¥19,200 → 3,000件（6.4円/件）`;

const CHARGE_MESSAGE = {
  type: 'text',
  text: `💳 無料枠（100件）を使い切りました。\n続けてご利用いただくにはチャージが必要です。\n\nチャージしてご利用ください。\n\n${CHARGE_PRICING_TEXT}`,
  quickReply: CHARGE_QUICK_REPLY,
};

const CHARGE_PLANS = [
  { amount: 2980, credits: 300, label: '¥2,980 → 300件' },
  { amount: 4980, credits: 600, label: '¥4,980 → 600件' },
  { amount: 8980, credits: 1200, label: '¥8,980 → 1,200件' },
  { amount: 19200, credits: 3000, label: '¥19,200 → 3,000件' },
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
 * lineUserId から LineUser を取得し、紐づく User の情報を返すヘルパー
 * LineUser が存在しない場合は作成する
 * User が紐づいていない場合は autolistCredits=100 の新規 User を作成して紐づける
 */
async function getOrCreateUserForLine(lineUserId: string): Promise<{
  lineUser: { id: string; lineUserId: string; displayName: string | null; state: string | null; userId: string | null };
  userId: string;
  credits: number;
} | null> {
  let lineUser = await prisma.lineUser.findUnique({ where: { lineUserId } });

  if (!lineUser) {
    lineUser = await prisma.lineUser.create({
      data: {
        lineUserId,
        displayName: null,
        state: null,
      },
    });
  }

  if (lineUser.userId) {
    // 既に User に紐づいている
    const user = await prismaShiryolog.user.findUnique({
      where: { id: lineUser.userId },
      select: { autolistCredits: true },
    });
    return {
      lineUser,
      userId: lineUser.userId,
      credits: user?.autolistCredits ?? 0,
    };
  }

  // userId が null = 連携解除済み or 未連携
  // 新規Userの自動作成はしない → Webから連携してもらう
  return null;
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

const LINK_REQUIRED_MESSAGE = `Webアカウントとの連携が必要です。\n\n📌 連携コードをお持ちの方\n6桁のコードをこのトークに送信してください。\n例: 「123456」\n\n━━━ 初めての方 ━━━\n① Webサイトにログイン\n② 「マイリスト」→「LINE連携」ボタン\n③ 表示された6桁コードをこのトークに送信\n\n▼ ログインはこちら\nhttps://autolist.shiryolog.com/login?openExternalBrowser=1`;

/**
 * LINEイベントを処理する
 */
async function handleEvents(events: LineEvent[]): Promise<void> {
  for (const event of events) {
    // 友だち追加イベントの処理
    if (event.type === 'follow') {
      if (event.replyToken) {
        const lineUserId = event.source.userId;
        const userResult = await getOrCreateUserForLine(lineUserId);
        if (!userResult) {
          // 未連携ユーザー: おかえり + 連携コード送信案内
          await replyMessage(event.replyToken, `おかえりなさい！👋\n友だち追加ありがとうございます。\n\n━━━ LINE連携の手順 ━━━\n\n① Webサイトにログイン\n② 「マイリスト」→「LINE連携」ボタン\n③ 表示された6桁コードをこのトークに送信\n\n例: 「123456」\n\n▼ ログインはこちら\nhttps://autolist.shiryolog.com/login?openExternalBrowser=1`);
          continue;
        }
        const { credits } = userResult;
        if (credits > 0) {
          // 既存ユーザー（おかえり）
          const existingLineUser = await prisma.lineUser.findUnique({ where: { lineUserId } });
          if (existingLineUser?.userId) {
            await replyMessage(event.replyToken, `おかえりなさい！👋\n\nオートリストをまたご利用いただきありがとうございます。\n\n💳 残りクレジット: ${credits}件\n\nさっそく依頼してみてください！\n例: 「渋谷区の不動産会社 30件」`);
          } else {
            await replyMessage(event.replyToken, WELCOME_MESSAGE);
          }
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

      // 連携不要のアクションは先に処理
      if (action === 'contact') {
        if (replyToken) {
          await replyMessage(replyToken, {
            type: 'flex',
            altText: 'お問い合わせ',
            contents: {
              type: 'bubble',
              body: {
                type: 'box', layout: 'vertical', contents: [
                  { type: 'text', text: '📩 お問い合わせ', weight: 'bold', size: 'md' },
                  { type: 'text', text: 'お気軽にご連絡ください。', size: 'sm', color: '#888888', margin: 'md', wrap: true },
                ],
              },
              footer: {
                type: 'box', layout: 'vertical', contents: [
                  { type: 'button', action: { type: 'uri', label: 'お問い合わせページを開く', uri: 'https://autolist.shiryolog.com/contact?openExternalBrowser=1' }, style: 'primary', color: '#06C755' },
                ],
              },
            },
          } as never);
        }
        continue;
      }

      // ユーザーを取得（連携必須のアクション）
      const pbResult = await getOrCreateUserForLine(lineUserId);
      if (!pbResult) {
        if (replyToken) {
          await replyMessage(replyToken, LINK_REQUIRED_MESSAGE);
        }
        continue;
      }
      const { lineUser: pbLineUser, userId: pbUserId, credits: pbCredits } = pbResult;

      switch (action) {
        case 'new_request':
          // stateをクリアして通常フローに戻す
          await prisma.lineUser.update({
            where: { id: pbLineUser.id },
            data: { state: null },
          });
          if (replyToken) {
            await replyMessage(replyToken, '業種と地域を送ってください。\n例：「渋谷区の不動産会社30件」');
          }
          break;

        case 'check_credits':
          if (replyToken) {
            await replyMessage(replyToken, `💳 残クレジット: ${pbCredits}件`);
          }
          break;

        case 'charge': {
          // stateをawaiting_chargeに更新してチャージ案内
          await prisma.lineUser.update({
            where: { id: pbLineUser.id },
            data: { state: 'awaiting_charge' },
          });
          const chargeReplyObj = pbCredits <= 0
            ? CHARGE_MESSAGE
            : {
                type: 'text',
                text: `💳 現在の残クレジット: ${pbCredits}件\n\nさらにチャージすることもできます。\n\n${CHARGE_PRICING_TEXT}`,
                quickReply: CHARGE_QUICK_REPLY,
              };
          if (replyToken) {
            await replyMessage(replyToken, chargeReplyObj);
          }
          break;
        }

        case 'history': {
          if (replyToken) {
            const jobs = await prisma.listJob.findMany({
              where: { userId: pbUserId },
              orderBy: { createdAt: 'desc' },
              take: 5,
            });

            if (jobs.length === 0) {
              await replyMessage(replyToken, `📋 依頼履歴はまだありません。\n\n「新規依頼」から最初のリスト収集を始めましょう！`);
            } else {
              const statusEmoji: Record<string, string> = {
                completed: '✅完了',
                running: '⏳収集中',
                pending: '🕐待機中',
                cancelled: '❌キャンセル',
                failed: '⚠️失敗',
              };
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://autolist.shiryolog.com';
              const lines = jobs.map((job, i) => {
                const emoji = statusEmoji[job.status] || job.status;
                const location = job.location || '';
                const industry = job.industry || '';
                const count = job.targetCount || 0;
                return `${i + 1}. ${location} ${industry} ${count}件 ${emoji}`;
              });
              const msg = `📋 依頼履歴（直近${jobs.length}件）\n\n${lines.join('\n')}\n\n詳細はこちら →\n${appUrl}/my-lists?openExternalBrowser=1`;
              await replyMessage(replyToken, msg);
            }
          }
          break;
        }

        case 'help':
          if (replyToken) {
            await replyMessage(replyToken, HELP_MESSAGE);
          }
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
      // --- LINE連携コマンドの処理 ---
      const linkMatch = messageText.match(/^(?:連携\s*)?(\d{6})$/);
      if (linkMatch) {
        const linkCode = linkMatch[1];
        const now = new Date();

        const linkRecord = await prisma.lineLinkCode.findFirst({
          where: {
            code: linkCode,
            expiresAt: { gt: now },
            usedAt: null,
          },
        });

        if (linkRecord) {
          // LineUserを取得または作成
          let lineUser = await prisma.lineUser.findUnique({ where: { lineUserId } });
          if (!lineUser) {
            // LINE表示名を取得
            let displayName: string | null = null;
            try {
              const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
                headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
              });
              if (profileRes.ok) {
                const profile = await profileRes.json();
                displayName = profile.displayName || null;
              }
            } catch {
              // プロフィール取得失敗は無視
            }

            lineUser = await prisma.lineUser.create({
              data: { lineUserId, displayName, state: null },
            });
          }

          // 重複連携チェック1: このLINEアカウントが既に別のWebアカウントに連携されている場合
          if (lineUser.userId && lineUser.userId !== linkRecord.userId) {
            // コードは使用済みにする（リトライ防止）
            await prisma.lineLinkCode.update({
              where: { id: linkRecord.id },
              data: { usedAt: now },
            });
            if (replyToken) {
              await replyMessage(replyToken, 'このLINEアカウントは既に別のWebアカウントに連携されています。現在の連携を解除してから再度お試しください。');
            }
            continue;
          }

          // 重複連携チェック2: 対象Webアカウントが既に別のLINEアカウントと連携されている場合
          const existingLink = await prisma.lineUser.findFirst({
            where: { userId: linkRecord.userId, NOT: { lineUserId } },
          });
          if (existingLink) {
            // コードは使用済みにする（リトライ防止）
            await prisma.lineLinkCode.update({
              where: { id: linkRecord.id },
              data: { usedAt: now },
            });
            if (replyToken) {
              await replyMessage(replyToken, 'このWebアカウントは既に別のLINEアカウントと連携されています。');
            }
            continue;
          }

          // LineUser.userIdをLineLinkCode.userIdに設定
          await prisma.lineUser.update({
            where: { id: lineUser.id },
            data: { userId: linkRecord.userId },
          });

          // LineLinkCode.usedAtを更新
          await prisma.lineLinkCode.update({
            where: { id: linkRecord.id },
            data: { usedAt: now },
          });

          if (replyToken) {
            await replyMessage(replyToken, `連携が完了しました！🎉\nWebアカウントと紐づけされました。\n\nLINEからリスト収集の依頼が可能です！\n以下のように送ってみてください：\n\n「渋谷区の不動産会社 30件」\n「大阪市の美容サロン 30件」`);
          }
        } else {
          if (replyToken) {
            await replyMessage(replyToken, '連携コードが無効または期限切れです。Webページから再発行してください。');
          }
        }
        continue;
      }

      // ヘルプコマンドの処理
      if (HELP_COMMANDS.includes(messageText.toLowerCase())) {
        if (replyToken) {
          await replyMessage(replyToken, HELP_MESSAGE);
        }
        continue;
      }

      // 問い合わせテキストの処理
      if (messageText.trim() === '問い合わせ' || messageText.trim() === 'お問い合わせ') {
        if (replyToken) {
          await replyMessage(replyToken, {
            type: 'flex',
            altText: 'お問い合わせ',
            contents: {
              type: 'bubble',
              body: {
                type: 'box', layout: 'vertical', contents: [
                  { type: 'text', text: '📩 お問い合わせ', weight: 'bold', size: 'md' },
                  { type: 'text', text: 'お気軽にご連絡ください。', size: 'sm', color: '#888888', margin: 'md', wrap: true },
                ],
              },
              footer: {
                type: 'box', layout: 'vertical', contents: [
                  { type: 'button', action: { type: 'uri', label: 'お問い合わせページを開く', uri: 'https://autolist.shiryolog.com/contact?openExternalBrowser=1' }, style: 'primary', color: '#06C755' },
                ],
              },
            },
          } as never);
        }
        continue;
      }

      // ユーザーを取得
      const msgResult = await getOrCreateUserForLine(lineUserId);
      if (!msgResult) {
        if (event.replyToken) {
          await replyMessage(event.replyToken, LINK_REQUIRED_MESSAGE);
        }
        continue;
      }
      const { lineUser: userLineUser, userId, credits: userCredits } = msgResult;
      // lineUser の state は LineUser テーブルで管理
      const userState = userLineUser.state;

      // --- 実行中キャンセルコマンドの処理 ---
      // awaiting_confirmation / awaiting_charge 以外の状態でキャンセルが送信された場合
      if (
        (messageText.trim() === 'キャンセル' || messageText.trim() === 'cancel') &&
        !userState?.startsWith('{') &&
        userState !== 'awaiting_charge'
      ) {
        // 処理中のジョブを探す
        const runningJob = await prisma.listJob.findFirst({
          where: {
            userId,
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
      if (userState === 'awaiting_charge') {
        // QuickReplyボタンのテキストマッチ（「300件」「600件」「1,200件」「3,000件」）
        const chargeTextMap: Record<string, number> = {
          '300件': 0,
          '600件': 1,
          '1,200件': 2,
          '1200件': 2,
          '3,000件': 3,
          '3000件': 3,
        };
        const planIndex = chargeTextMap[messageText.trim()];

        if (planIndex !== undefined) {
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
          continue;
        } else {
          // プラン選択以外のメッセージ → stateをクリアして通常フローに戻す
          await prisma.lineUser.update({
            where: { id: userLineUser.id },
            data: { state: null },
          });
          // continueせずに後続の依頼フローに進む
        }
      }

      // --- 確認待ち状態の処理 ---
      // credits を最新で取得し直す（stateクリア後に進んだ場合のため）
      let currentCredits = userCredits;
      let skipConfirmationBlock = false;
      if (userState?.startsWith('{')) {
        const pendingState = JSON.parse(userState);

        if (pendingState.status === 'awaiting_confirmation') {
          const answer = messageText.trim();

          if (answer === 'はい' || answer === 'yes' || answer === 'YES' || answer === 'ハイ') {
            // state をクリア
            await prisma.lineUser.update({
              where: { id: userLineUser.id },
              data: { state: null },
            });

            // ジョブ作成
            const reservedCredits = pendingState.targetCount;
            const job = await prisma.listJob.create({
              data: {
                userId,
                keyword: pendingState.keyword,
                industry: pendingState.industry,
                location: pendingState.location,
                targetCount: pendingState.targetCount,
                reservedCredits: reservedCredits,
                status: 'pending',
                originalMessage: pendingState.originalMessage,
                industryKeywords: pendingState.industryKeywords || [],
              },
            });

            // クレジット仮押さえ（User テーブル）
            await prismaShiryolog.user.update({
              where: { id: userId },
              data: {
                autolistCredits: { decrement: reservedCredits },
              },
            });

            // SearchLog記録
            await prisma.searchLog.create({
              data: {
                userId,
                lineUserId: lineUserId,
                keyword: pendingState.keyword,
                industry: pendingState.industry,
                location: pendingState.location,
                targetCount: pendingState.targetCount,
                jobId: job.id,
              },
            });

            // クレジット仮押さえ済み（完了時に差分返却）
            const remainingAfterReserve = currentCredits - reservedCredits;

            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';
            const acceptanceMessage = `✅ リスト収集を開始します！

条件:
・業種: ${pendingState.industry || '指定なし'}
・地域: ${pendingState.location || '指定なし'}
・件数: ${pendingState.targetCount}社

💳 ${reservedCredits}クレジット仮押さえ → 残り${remainingAfterReserve}クレジット
（収集できた分だけ消費、残りは返却）

完了したらLINEとメールでお知らせします。
リストの確認・CSVダウンロードはこちら👇
${appUrl}/my-lists?openExternalBrowser=1`;

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
              where: { id: userLineUser.id },
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
              if (currentCredits < newCount) {
                if (replyToken) {
                  await replyMessage(replyToken, `⚠️ クレジットが不足しています。\n残クレジット: ${currentCredits}件\n\nチャージ後に再度お試しください。`);
                }
                continue;
              }

              // state の targetCount を更新して保存
              const updatedState = JSON.stringify({
                ...pendingState,
                targetCount: newCount,
              });
              await prisma.lineUser.update({
                where: { id: userLineUser.id },
                data: { state: updatedState },
              });

              // 更新した確認メッセージを再送
              const remainingAfter = currentCredits - newCount;
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
              where: { id: userLineUser.id },
              data: { state: null },
            });
            skipConfirmationBlock = true;
          }

          if (!skipConfirmationBlock) {
            continue;
          }
        }
      }

      // 最新のクレジットを再取得（state処理でクリアした場合も含む）
      const latestUser = await prismaShiryolog.user.findUnique({
        where: { id: userId },
        select: { autolistCredits: true },
      });
      currentCredits = latestUser?.autolistCredits ?? 0;

      // --- クレジット残量チェック ---
      if (currentCredits <= 0) {
        // チャージ履歴の有無で分岐
        const purchaseCount = await prisma.purchase.count({ where: { userId } });

        // stateをawaiting_chargeに更新
        await prisma.lineUser.update({
          where: { id: userLineUser.id },
          data: { state: 'awaiting_charge' },
        });

        if (purchaseCount === 0) {
          // チャージ履歴なし
          if (replyToken) {
            await replyMessage(replyToken, CHARGE_MESSAGE);
          }
        } else {
          // チャージ履歴あり
          const chargeMessageObj = {
            type: 'text',
            text: `💳 クレジットが不足しています。\n残り: ${currentCredits}件\n\nチャージしてご利用ください。\n\n${CHARGE_PRICING_TEXT}`,
            quickReply: CHARGE_QUICK_REPLY,
          };
          if (replyToken) {
            await replyMessage(replyToken, chargeMessageObj);
          }
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
        // 全項目不足（関係ないメッセージ）の場合はやわらかい案内を返す
        if (missingFields.length === 3) {
          if (replyToken) {
            await replyMessage(replyToken, `何かお困りですか？リスト収集は業種・地域・件数を送るだけです。\n\n例：「渋谷区の不動産会社 30件」\n\nお問い合わせの場合は、「問い合わせ」ボタンを押していただくと、カスタマー担当が対応いたします。`);
          }
          continue;
        }

        // 一部不足の場合、stateは保存せず「まとめて送ってください」案内を返す
        if (replyToken) {
          await replyMessage(replyToken, `📝 業種・地域・件数をまとめて1つのメッセージで送ってください。\n\n例：「カレー屋 東京都 50件」\n例：「歯科医院 渋谷区 30件」\n例：「不動産会社 大阪市 100件」`);
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
      if (currentCredits < analyzed.targetCount) {
        // チャージ履歴の有無で分岐
        const purchaseCount = await prisma.purchase.count({ where: { userId } });

        // stateをawaiting_chargeに更新
        await prisma.lineUser.update({
          where: { id: userLineUser.id },
          data: { state: 'awaiting_charge' },
        });

        const chargeMessageObj = {
          type: 'text',
          text: `💳 クレジットが不足しています。\n残り: ${currentCredits}件 / 必要: ${analyzed.targetCount}件\n\nチャージしてご利用ください。\n\n${CHARGE_PRICING_TEXT}`,
          quickReply: CHARGE_QUICK_REPLY,
        };

        if (replyToken) {
          await replyMessage(replyToken, chargeMessageObj);
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
        where: { id: userLineUser.id },
        data: { state: confirmationState },
      });

      const remainingAfter = currentCredits - analyzed.targetCount;
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
      const errorMessage = `申し訳ありません。システムエラーが発生しました。

お手数ですが、しばらく後にもう一度お試しください。問題が続く場合は「問い合わせ」ボタンからご連絡ください。`;

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
