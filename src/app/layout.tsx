import type { Metadata } from 'next';
import './globals.css';
import './lp.css';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
