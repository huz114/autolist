'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Stripe Checkout完了後のコールバックページ
 * Stripeからのクロスサイトリダイレクトでセッションcookieが送信されない問題を回避するため、
 * 公開ページで受けてからクライアントサイドで/my-listsにリダイレクトする
 */
function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get('status') || 'success';
    window.location.href = `/my-lists?payment=${status}`;
  }, [searchParams]);

  return (
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4" />
      <p className="text-gray-600">リダイレクト中...</p>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense
        fallback={
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4" />
            <p className="text-gray-600">リダイレクト中...</p>
          </div>
        }
      >
        <PaymentCallbackContent />
      </Suspense>
    </div>
  );
}
