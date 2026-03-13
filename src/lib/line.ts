import * as crypto from 'crypto';

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

/**
 * LINEユーザーにメッセージを送信する
 */
export async function sendMessage(lineUserId: string, message: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  }

  const body = JSON.stringify({
    to: lineUserId,
    messages: [
      {
        type: 'text',
        text: message,
      },
    ],
  });

  const response = await fetch(LINE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE API error: ${response.status} ${error}`);
  }
}

/**
 * LINE Webhookの署名を検証する
 */
export async function verifySignature(body: string, signature: string): Promise<boolean> {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelSecret) {
    throw new Error('LINE_CHANNEL_SECRET is not set');
  }

  const hmac = crypto.createHmac('sha256', channelSecret);
  hmac.update(body);
  const digest = hmac.digest('base64');

  return digest === signature;
}

/**
 * LINE ReplyTokenでメッセージを返信する
 */
export async function replyMessage(replyToken: string, message: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  }

  const body = JSON.stringify({
    replyToken,
    messages: [
      {
        type: 'text',
        text: message,
      },
    ],
  });

  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE Reply API error: ${response.status} ${error}`);
  }
}

/**
 * LINEユーザープロフィールを取得する
 */
export async function getUserProfile(lineUserId: string): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not set');
  }

  const response = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LINE Profile API error: ${response.status} ${error}`);
  }

  return response.json();
}
