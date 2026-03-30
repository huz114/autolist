import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

const PLANS = [
  { id: 'plan_200', amount: 1980, credits: 200, label: '200件' },
  { id: 'plan_500', amount: 3980, credits: 500, label: '500件' },
  { id: 'plan_1000', amount: 6980, credits: 1000, label: '1,000件' },
  { id: 'plan_3000', amount: 19200, credits: 3000, label: '3,000件' },
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

  // LineUser の lineUserId を取得（Stripe webhook での照合用フォールバック）
  const lineUser = await prisma.lineUser.findFirst({
    where: { userId: session.user.id },
    select: { lineUserId: true },
  });

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
        userId: session.user.id,
        credits: String(plan.credits),
        // 旧方式との互換性のため lineUserId も含める
        ...(lineUser ? { lineUserId: lineUser.lineUserId } : {}),
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
