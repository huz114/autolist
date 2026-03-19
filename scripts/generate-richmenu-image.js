#!/usr/bin/env node
/**
 * リッチメニュー画像生成スクリプト
 * サイズ: 2500 × 1124px（LINE推奨サイズ、6ボタン横3×縦2、縦2/3縮小版）
 * 出力先: public/richmenu.png
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 2500;
const HEIGHT = 1124;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// ボタン定義（左→右、上→下）
const buttons = [
  { label: '新規依頼', icon: 'clipboard', row: 0 },
  { label: '残クレジット', icon: 'coin', row: 0 },
  { label: '依頼履歴', icon: 'history', row: 0 },
  { label: 'チャージ', icon: 'bolt', row: 1 },
  { label: '使い方', icon: 'book', row: 1 },
  { label: '問い合わせ', icon: 'chat', row: 1 },
];

function drawIcon(ctx, type, cx, cy, size) {
  ctx.strokeStyle = '#06C755';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (type) {
    case 'clipboard':
      // クリップボード
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.6, cy - size * 0.7, size * 1.2, size * 1.4, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.3, cy - size * 0.85, size * 0.6, size * 0.3, 6);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.35, cy - size * 0.15 + i * size * 0.3);
        ctx.lineTo(cx + size * 0.35, cy - size * 0.15 + i * size * 0.3);
        ctx.stroke();
      }
      break;

    case 'coin':
      // コイン
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `bold ${size * 0.8}px sans-serif`;
      ctx.fillStyle = '#06C755';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('¥', cx, cy);
      break;

    case 'history':
      // 時計
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - size * 0.45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + size * 0.35, cy + size * 0.2);
      ctx.stroke();
      break;

    case 'bolt':
      // 雷マーク
      ctx.beginPath();
      ctx.moveTo(cx + size * 0.15, cy - size * 0.8);
      ctx.lineTo(cx - size * 0.25, cy + size * 0.05);
      ctx.lineTo(cx + size * 0.1, cy + size * 0.05);
      ctx.lineTo(cx - size * 0.15, cy + size * 0.8);
      ctx.lineTo(cx + size * 0.25, cy - size * 0.05);
      ctx.lineTo(cx - size * 0.1, cy - size * 0.05);
      ctx.closePath();
      ctx.stroke();
      break;

    case 'book':
      // 本
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.55, cy - size * 0.7, size * 1.1, size * 1.4, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.2, cy - size * 0.7);
      ctx.lineTo(cx - size * 0.2, cy + size * 0.7);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.0, cy - size * 0.3 + i * size * 0.3);
        ctx.lineTo(cx + size * 0.4, cy - size * 0.3 + i * size * 0.3);
        ctx.stroke();
      }
      break;

    case 'chat':
      // 吹き出し
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.7, cy - size * 0.6, size * 1.4, size * 1.0, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.3, cy + size * 0.4);
      ctx.lineTo(cx - size * 0.5, cy + size * 0.8);
      ctx.lineTo(cx + size * 0.1, cy + size * 0.4);
      ctx.stroke();
      break;
  }
}

// 背景グラデーション（ダークグリーン）
const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
bgGrad.addColorStop(0, '#0a1a0f');
bgGrad.addColorStop(1, '#0d2818');
ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

const cols = 3;
const rows = 2;
const btnW = Math.floor(WIDTH / cols);   // 833px
const btnH = Math.floor(HEIGHT / rows);  // 843px

buttons.forEach((btn, i) => {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = col * btnW;
  const y = row * btnH;

  // ボタン背景（少し明るいダークグリーン）
  const btnGrad = ctx.createLinearGradient(x, y, x, y + btnH);
  if (row === 0) {
    btnGrad.addColorStop(0, '#0e2a1a');
    btnGrad.addColorStop(1, '#0b2015');
  } else {
    btnGrad.addColorStop(0, '#0b2015');
    btnGrad.addColorStop(1, '#091a10');
  }
  ctx.fillStyle = btnGrad;
  ctx.fillRect(x, y, btnW, btnH);

  // 区切り線（右）
  if (col < cols - 1) {
    ctx.strokeStyle = 'rgba(6, 199, 85, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + btnW, y + 27);
    ctx.lineTo(x + btnW, y + btnH - 27);
    ctx.stroke();
  }

  // 区切り線（下）- 行の間
  if (row === 0) {
    ctx.strokeStyle = 'rgba(6, 199, 85, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 27, y + btnH);
    ctx.lineTo(x + btnW - 27, y + btnH);
    ctx.stroke();
  }

  // アイコン（ボタン中央より少し上）
  const iconCX = x + btnW / 2;
  const iconCY = y + btnH * 0.38;
  drawIcon(ctx, btn.icon, iconCX, iconCY, 68);

  // メインテキスト（29px相当 → canvas高解像度なので72px）
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 77px "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, x + btnW / 2, y + btnH * 0.68);
});

// 上部アクセントライン
ctx.fillStyle = '#06C755';
ctx.fillRect(0, 0, WIDTH, 4);

// PNG出力
const outputPath = path.join(__dirname, '../public/richmenu.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);
console.log(`生成完了: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
