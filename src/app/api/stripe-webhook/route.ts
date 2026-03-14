import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendMessage } from '@/lib/line';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

/**
 * POST /api/stripe-webhook
 * Stripe Webhookエンドポイント
 * checkout.session.completed イベントを受け取りクレジットを付与する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event: Stripe.Event;

  // Webhook署名検証（シークレットが設定されている場合のみ）
  if (webhookSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else {
    // 開発環境: シークレット未設定の場合はそのままパース
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // checkout.session.completed イベント処理
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const lineUserId = session.metadata?.lineUserId;
    const creditsStr = session.metadata?.credits;

    if (!lineUserId || !creditsStr) {
      console.error('Missing metadata in Stripe session:', session.id);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const creditsToAdd = parseInt(creditsStr, 10);
    if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
      console.error('Invalid credits value:', creditsStr);
      return NextResponse.json({ error: 'Invalid credits' }, { status: 400 });
    }

    try {
      // ユーザーを取得
      const user = await prisma.lineUser.findUnique({
        where: { lineUserId },
      });

      if (!user) {
        console.error('User not found for lineUserId:', lineUserId);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Purchaseレコードを作成
      const amount = session.amount_total ?? 0;
      await prisma.purchase.create({
        data: {
          userId: user.id,
          amount,
          credits: creditsToAdd,
          stripeId: session.id,
        },
      });

      // クレジットを加算 & stateをリセット
      const updatedUser = await prisma.lineUser.update({
        where: { lineUserId },
        data: {
          credits: { increment: creditsToAdd },
          state: null,
        },
      });

      console.log(
        `Credits added: lineUserId=${lineUserId}, added=${creditsToAdd}, newTotal=${updatedUser.credits}`
      );

      // LINE完了通知
      const completionMessage = `✅ チャージ完了しました！

💳 ${creditsToAdd}件のクレジットが付与されました。
残クレジット: ${updatedUser.credits}件

引き続きリスト収集をご利用いただけます。
業種・地域・件数を送信してください。`;

      await sendMessage(lineUserId, completionMessage);
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
