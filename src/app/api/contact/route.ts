import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, company, email, message } = body as {
      name?: string
      company?: string
      email?: string
      message?: string
    }

    // バリデーション
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'お名前を入力してください' },
        { status: 400 }
      )
    }
    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'メールアドレスを入力してください' },
        { status: 400 }
      )
    }
    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'お問い合わせ内容を入力してください' },
        { status: 400 }
      )
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      )
    }

    const htmlContent = buildContactEmailHtml(name.trim(), email.trim(), message.trim(), company?.trim())

    // 開発環境（API Key未設定）はコンソール出力のみ
    if (!resend) {
      console.log('========================================')
      console.log('[DEV] お問い合わせメール')
      console.log(`Name: ${name}`)
      if (company) console.log(`Company: ${company}`)
      console.log(`Email: ${email}`)
      console.log(`Message: ${message}`)
      console.log('========================================')
      return NextResponse.json({ success: true })
    }

    const { error } = await resend.emails.send({
      from: 'オートリスト <noreply@shiryolog.com>',
      to: 'info@ai-ll.co',
      replyTo: email.trim(),
      subject: `【オートリスト】お問い合わせ: ${name.trim()}`,
      html: htmlContent,
    })

    if (error) {
      console.error('Resend contact email error:', error)
      return NextResponse.json(
        { error: 'メール送信に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact API error:', err)
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}

function buildContactEmailHtml(name: string, email: string, message: string, company?: string): string {
  const escapedName = escapeHtml(name)
  const escapedCompany = company ? escapeHtml(company) : null
  const escapedEmail = escapeHtml(email)
  const escapedMessage = escapeHtml(message).replace(/\n/g, '<br>')

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
                  <td style="width:40px;height:40px;background:linear-gradient(135deg,#06C755,#05b34a);border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-size:18px;font-weight:bold;">A</span>
                  </td>
                  <td style="padding-left:10px;">
                    <div style="color:#f3f4f6;font-size:18px;font-weight:bold;line-height:1.2;">オートリスト</div>
                    <div style="color:#6b7280;font-size:11px;line-height:1.2;">お問い合わせ通知</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="color:#f3f4f6;font-size:20px;font-weight:bold;margin:0 0 24px;">新しいお問い合わせ</h1>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:12px 16px;background-color:#0a0a0f;border-radius:8px 8px 0 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="color:#6b7280;font-size:11px;margin-bottom:4px;">お名前</div>
                    <div style="color:#f3f4f6;font-size:14px;">${escapedName}</div>
                  </td>
                </tr>
                ${escapedCompany ? `<tr>
                  <td style="padding:12px 16px;background-color:#0a0a0f;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="color:#6b7280;font-size:11px;margin-bottom:4px;">企業名</div>
                    <div style="color:#f3f4f6;font-size:14px;">${escapedCompany}</div>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding:12px 16px;background-color:#0a0a0f;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <div style="color:#6b7280;font-size:11px;margin-bottom:4px;">メールアドレス</div>
                    <div style="color:#f3f4f6;font-size:14px;">
                      <a href="mailto:${escapedEmail}" style="color:#06C755;text-decoration:none;">${escapedEmail}</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;background-color:#0a0a0f;border-radius:0 0 8px 8px;">
                    <div style="color:#6b7280;font-size:11px;margin-bottom:4px;">お問い合わせ内容</div>
                    <div style="color:#f3f4f6;font-size:14px;line-height:1.7;">${escapedMessage}</div>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
              <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">
                このメールに返信すると、お問い合わせ者（${escapedEmail}）に直接送信されます。
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
