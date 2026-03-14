const puppeteer = require('puppeteer');
const path = require('path');

async function generateRichMenuPng() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // 2500×843px ビューポート設定
  await page.setViewport({ width: 2500, height: 843, deviceScaleFactor: 1 });

  // HTMLファイルを読み込む
  const htmlPath = path.resolve('/Users/hiroaki/Documents/autolist-richmenu-design.html');
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  // transformを削除して実サイズで表示
  await page.evaluate(() => {
    document.body.style.transform = '';
    document.body.style.transformOrigin = '';
    document.documentElement.style.height = '843px';
    document.documentElement.style.overflow = 'visible';
    document.body.style.overflow = 'visible';
  });

  // Google Fonts読み込み待機
  await new Promise(r => setTimeout(r, 2000));

  // スクリーンショット
  const outputPath = '/Users/hiroaki/application/autolist/public/richmenu.png';
  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: 2500, height: 843 }
  });

  await browser.close();
  console.log(`PNG生成完了: ${outputPath}`);
}

generateRichMenuPng().catch(console.error);
