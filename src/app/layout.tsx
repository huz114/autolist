import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'オートリスト - LINE・Webでビジネスリスト自動収集',
  description: 'LINEまたはWebから依頼するだけで、AIがGoogleからビジネスリストを自動収集します。',
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
      <body>
        {children}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-6B7E19SN0M" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-6B7E19SN0M');
          `}
        </Script>
      </body>
    </html>
  );
}
