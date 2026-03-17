// メール送信ユーティリティ（Resend SDK）- メール認証用
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3007'

/**
 * メール認証用の確認メールを送信
 * RESEND_API_KEY が未設定の場合はコンソール出力のみ
 */
export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`

  // 開発環境（API Key未設定）はコンソール出力のみ
  if (!resend) {
    console.log('========================================')
    console.log('[DEV] メール認証トークン')
    console.log(`Email: ${email}`)
    console.log(`Token: ${token}`)
    console.log(`URL: ${verifyUrl}`)
    console.log('========================================')
    return { success: true }
  }

  try {
    const { error } = await resend.emails.send({
      from: 'オートリスト <noreply@shiryolog.com>',
      to: email,
      subject: '【オートリスト】メールアドレスの確認',
      html: buildVerificationEmailHtml(verifyUrl),
    })

    if (error) {
      console.error('Resend email error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('Failed to send verification email:', err)
    return {
      success: false,
      error: 'メール送信に失敗しました',
    }
  }
}

/**
 * 確認メールのHTMLテンプレート（ダークテーマ）
 */
function buildVerificationEmailHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#08080d;font-family:'Helvetica Neue',Arial,'Hiragino Sans',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080d;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#16161f;border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 0;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:40px;height:40px;background:linear-gradient(135deg,#f97316,#ea580c);border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:18px;font-weight:bold;">A</span>
                  </td>
                  <td style="padding-left:10px;">
                    <div style="color:#f3f4f6;font-size:18px;font-weight:bold;line-height:1.2;">オートリスト</div>
                    <div style="color:#6b7280;font-size:11px;line-height:1.2;">Auto List Generation</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="color:#f3f4f6;font-size:20px;font-weight:bold;margin:0 0 16px;">メールアドレスの確認</h1>
              <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 24px;">
                オートリストへのご登録ありがとうございます。<br>
                下のボタンをクリックしてメールアドレスを確認してください。
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#f97316,#ea580c);border-radius:8px;padding:12px 32px;">
                    <a href="${verifyUrl}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;display:block;">
                      メールアドレスを確認する
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0 0 16px;">
                ボタンがクリックできない場合は、以下のURLをブラウザに貼り付けてください：
              </p>
              <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0 0 24px;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#f97316;text-decoration:underline;">${verifyUrl}</a>
              </p>
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
              <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">
                このリンクは24時間有効です。<br>
                心当たりのない場合は、このメールを無視してください。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
