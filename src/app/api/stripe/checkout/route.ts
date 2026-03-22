import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

const PLANS = [
  { id: 'plan_100', amount: 2000, credits: 100, label: '100件' },
  { id: 'plan_300', amount: 5000, credits: 300, label: '300件' },
  { id: 'plan_700', amount: 10000, credits: 700, label: '700件' },
  { id: 'plan_1500', amount: 15000, credits: 1500, label: '1,500件' },
];

/**
 * POST /api/stripe/checkout
 * Stripe Checkout Sessionを作成してURLを返す
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // LineUserを取得（lineUserIdが必要 - webhookでの照合用）
  const lineUser = await prisma.lineUser.findFirst({
    where: { userId: session.user.id },
  });

  if (!lineUser) {
    return NextResponse.json(
      { error: 'LINEアカウントが連携されていません' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { planId } = body;

    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: `オートリスト ${plan.label}`,
              description: `${plan.credits}件分のクレジット`,
            },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        lineUserId: lineUser.lineUserId,
        credits: String(plan.credits),
      },
      success_url: `${appUrl}/payment-callback?status=success`,
      cancel_url: `${appUrl}/payment-callback?status=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'チェックアウトセッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}
