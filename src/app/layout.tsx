import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'オートリスト - LINEでビジネスリスト自動収集',
  description: 'LINEでメッセージを送るだけで、AIがGoogleからビジネスリストを自動収集します。',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
