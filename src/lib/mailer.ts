import { Resend } from 'resend';

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(apiKey);
}

export async function sendJobCompletedEmail(params: {
  to: string;
  userName: string;
  keyword: string;
  industry: string | null;
  location: string | null;
  totalFound: number;
  myListsUrl: string;
}): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: 'オートリスト <noreply@shiryolog.com>',
    to: params.to,
    subject: `【オートリスト】収集完了 - ${params.totalFound}件`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>&#x2705; 営業リストの収集が完了しました</h2>
        <p>${params.userName} 様</p>
        <p>以下の条件でリストを収集しました。</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">キーワード</td><td style="padding: 8px; border: 1px solid #ddd;">${params.keyword}</td></tr>
          ${params.industry ? `<tr><td style="padding: 8px; border: 1px solid #ddd;">業種</td><td style="padding: 8px; border: 1px solid #ddd;">${params.industry}</td></tr>` : ''}
          ${params.location ? `<tr><td style="padding: 8px; border: 1px solid #ddd;">地域</td><td style="padding: 8px; border: 1px solid #ddd;">${params.location}</td></tr>` : ''}
          <tr><td style="padding: 8px; border: 1px solid #ddd;">収集件数</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${params.totalFound}件</strong></td></tr>
        </table>
        <p style="margin-top: 24px;">
          <a href="${params.myListsUrl}" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            リストを確認する
          </a>
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          オートリスト | <a href="${params.myListsUrl}">マイページ</a>
        </p>
      </div>
    `,
  });
}

export async function sendChargeCompletedEmail(params: {
  to: string;
  userName: string;
  creditsAdded: number;
  totalCredits: number;
  amount: number;
  myListsUrl: string;
}): Promise<void> {
  const resend = getResend();
  const amountStr = params.amount.toLocaleString();
  await resend.emails.send({
    from: 'オートリスト <noreply@shiryolog.com>',
    to: params.to,
    subject: `【オートリスト】チャージ完了 - ${params.creditsAdded}件`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>&#x2705; チャージが完了しました</h2>
        <p>${params.userName} 様</p>
        <p>クレジットのチャージが正常に完了しました。</p>
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td style="padding: 8px; border: 1px solid #ddd;">お支払い金額</td><td style="padding: 8px; border: 1px solid #ddd;">¥${amountStr}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">チャージ件数</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>+${params.creditsAdded}件</strong></td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;">残クレジット</td><td style="padding: 8px; border: 1px solid #ddd;"><strong>${params.totalCredits}件</strong></td></tr>
        </table>
        <p style="margin-top: 24px;">
          <a href="${params.myListsUrl}" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            リストを確認する
          </a>
        </p>
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          オートリスト | <a href="${params.myListsUrl}">マイページ</a>
        </p>
      </div>
    `,
  });
}
