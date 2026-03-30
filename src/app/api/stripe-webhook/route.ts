import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { prismaShiryolog } from '@/lib/prisma-shiryolog';
import { sendMessage } from '@/lib/line';
import { sendChargeCompletedEmail } from '@/lib/mailer';

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

    // metadata から userId を取得（新方式）。旧方式の lineUserId もフォールバック対応
    let userId = session.metadata?.userId;
    const creditsStr = session.metadata?.credits;

    if (!userId) {
      // 旧方式: lineUserId から User.id を解決
      const lineUserId = session.metadata?.lineUserId;
      if (lineUserId) {
        const lineUser = await prisma.lineUser.findUnique({
          where: { lineUserId },
          select: { userId: true },
        });
        userId = lineUser?.userId ?? undefined;
      }
    }

    if (!userId || !creditsStr) {
      console.error('Missing metadata in Stripe session:', session.id);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const creditsToAdd = parseInt(creditsStr, 10);
    if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
      console.error('Invalid credits value:', creditsStr);
      return NextResponse.json({ error: 'Invalid credits' }, { status: 400 });
    }

    try {
      // 冪等性チェック: 同じStripeセッションで既に処理済みか確認
      const existingPurchase = await prisma.purchase.findFirst({
        where: { stripeId: session.id },
      });

      if (existingPurchase) {
        console.log(`[StripeWebhook] Already processed session: ${session.id}, skipping`);
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Purchaseレコードを作成
      const amount = session.amount_total ?? 0;
      await prisma.purchase.create({
        data: {
          userId,
          amount,
          credits: creditsToAdd,
          stripeId: session.id,
        },
      });

      // User のクレジットを加算
      const updatedUser = await prismaShiryolog.user.update({
        where: { id: userId },
        data: {
          autolistCredits: { increment: creditsToAdd },
        },
      });

      // LineUser の state をリセット（LINE経由のチャージの場合）
      const lineUserId = session.metadata?.lineUserId;
      if (lineUserId) {
        await prisma.lineUser.update({
          where: { lineUserId },
          data: { state: null },
        }).catch(() => {
          // LineUser が存在しない場合は無視
        });
      }

      console.log(
        `Credits added: userId=${userId}, added=${creditsToAdd}, newTotal=${updatedUser.autolistCredits}`
      );

      // --- チャージ完了通知 ---
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://autolist.shiryolog.com';
      try {
        // ユーザー情報を取得
        const notifyUser = await prismaShiryolog.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true, autolistCredits: true },
        });

        if (notifyUser?.email) {
          // メール通知（LINE/Web両方）
          await sendChargeCompletedEmail({
            to: notifyUser.email,
            userName: notifyUser.name || 'お客',
            creditsAdded: creditsToAdd,
            totalCredits: notifyUser.autolistCredits ?? 0,
            amount: session.amount_total ?? 0,
            myListsUrl: `${appUrl}/my-lists`,
          });
        }

        // LINE通知（LINE経由のチャージの場合のみ）
        if (lineUserId) {
          await sendMessage(
            lineUserId,
            `✅ チャージ完了！\n\n+${creditsToAdd}件のクレジットが付与されました。\n💳 残クレジット: ${updatedUser.autolistCredits}件\n\nさっそく依頼してみてください！`
          );
        }
      } catch (notifyError) {
        // 通知失敗はログのみ（クレジット付与自体は成功しているので）
        console.error('Charge notification failed:', notifyError);
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
