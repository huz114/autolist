#!/usr/bin/env node
/**
 * LINEリッチメニュー設定スクリプト
 * 1. リッチメニュー定義を作成
 * 2. 画像をアップロード
 * 3. デフォルトリッチメニューとして設定
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://autolist.example.com';

if (!ACCESS_TOKEN) {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN が設定されていません');
  process.exit(1);
}

/**
 * HTTPリクエストユーティリティ
 */
function request(options, body) {
  return new Promise((resolve, reject) => {
    const lib = options.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json, raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Step 1: リッチメニュー定義を作成
 */
async function createRichMenu() {
  console.log('📋 Step 1: リッチメニュー定義を作成中...');

  const richMenuBody = {
    size: { width: 2500, height: 843 },
    selected: true,
    name: 'オートリストメニュー',
    chatBarText: 'メニュー',
    areas: [
      // 📋 新しく依頼する（左上）
      {
        bounds: { x: 0, y: 0, width: 833, height: 421 },
        action: { type: 'postback', data: 'action=new_request', displayText: '📋 新しく依頼する' }
      },
      // 💳 残クレジット確認（中央上）
      {
        bounds: { x: 833, y: 0, width: 834, height: 421 },
        action: { type: 'postback', data: 'action=check_credits', displayText: '💳 残クレジット確認' }
      },
      // 📊 依頼履歴（右上）
      {
        bounds: { x: 1667, y: 0, width: 833, height: 421 },
        action: { type: 'uri', uri: `${APP_URL}/my-lists` }
      },
      // 💰 チャージ（左下）
      {
        bounds: { x: 0, y: 421, width: 833, height: 422 },
        action: { type: 'postback', data: 'action=charge', displayText: '💰 チャージ' }
      },
      // ❓ 使い方（中央下）
      {
        bounds: { x: 833, y: 421, width: 834, height: 422 },
        action: { type: 'postback', data: 'action=help', displayText: '❓ 使い方' }
      },
      // 📞 問い合わせ（右下）
      {
        bounds: { x: 1667, y: 421, width: 833, height: 422 },
        action: { type: 'postback', data: 'action=contact', displayText: '📞 問い合わせ' }
      }
    ]
  };

  const bodyStr = JSON.stringify(richMenuBody);
  const res = await request({
    protocol: 'https:',
    hostname: 'api.line.me',
    path: '/v2/bot/richmenu',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  }, bodyStr);

  if (res.status !== 200) {
    console.error('❌ リッチメニュー作成失敗:', res.status, JSON.stringify(res.body));
    process.exit(1);
  }

  const richMenuId = res.body.richMenuId;
  console.log(`✅ リッチメニュー作成成功: ${richMenuId}`);
  return richMenuId;
}

/**
 * Step 2: 画像をアップロード
 */
async function uploadRichMenuImage(richMenuId) {
  console.log('🖼️  Step 2: リッチメニュー画像をアップロード中...');

  const imagePath = path.join(__dirname, '..', 'public', 'richmenu.png');
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ 画像ファイルが見つかりません: ${imagePath}`);
    console.error('   先に generate-richmenu-image.js を実行してください');
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  console.log(`   画像サイズ: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

  return new Promise((resolve, reject) => {
    const options = {
      protocol: 'https:',
      hostname: 'api-data.line.me',
      path: `/v2/bot/richmenu/${richMenuId}/content`,
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Length': imageBuffer.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error('❌ 画像アップロード失敗:', res.statusCode, data);
          process.exit(1);
        }
        console.log(`✅ 画像アップロード成功`);
        resolve();
      });
    });

    req.on('error', reject);
    req.write(imageBuffer);
    req.end();
  });
}

/**
 * Step 3: デフォルトリッチメニューとして設定
 */
async function setDefaultRichMenu(richMenuId) {
  console.log('⚙️  Step 3: デフォルトリッチメニューとして設定中...');

  const res = await request({
    protocol: 'https:',
    hostname: 'api.line.me',
    path: `/v2/bot/user/all/richmenu/${richMenuId}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Length': 0,
    },
  });

  if (res.status !== 200) {
    console.error('❌ デフォルト設定失敗:', res.status, JSON.stringify(res.body));
    process.exit(1);
  }

  console.log(`✅ デフォルトリッチメニューとして設定完了`);
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 LINEリッチメニュー設定を開始します');
  console.log(`   APP_URL: ${APP_URL}`);
  console.log('');

  try {
    const richMenuId = await createRichMenu();
    await uploadRichMenuImage(richMenuId);
    await setDefaultRichMenu(richMenuId);

    console.log('');
    console.log('🎉 リッチメニュー設定が完了しました！');
    console.log(`   リッチメニューID: ${richMenuId}`);
    console.log('');
    console.log('📱 LINEアプリでBotを開くとリッチメニューが表示されます。');
  } catch (err) {
    console.error('❌ エラー:', err);
    process.exit(1);
  }
}

main();
