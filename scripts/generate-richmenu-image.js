#!/usr/bin/env node
/**
 * リッチメニュー画像生成スクリプト
 * サイズ: 2500 × 843px（6ボタン横3×縦2）
 * 出力先: public/richmenu.png
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const WIDTH = 2500;
const HEIGHT = 843;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// ボタン定義（左→右、上→下）
const buttons = [
  { label: '新しく依頼する', sub: 'AIが自動収集', icon: 'clipboard', row: 0 },
  { label: '残クレジット確認', sub: '現在の残高', icon: 'coin', row: 0 },
  { label: '依頼履歴', sub: '過去のリスト', icon: 'history', row: 0 },
  { label: 'チャージ', sub: 'クレジット追加', icon: 'bolt', row: 1 },
  { label: '使い方', sub: 'ガイドを見る', icon: 'book', row: 1 },
  { label: '問い合わせ', sub: 'お気軽にどうぞ', icon: 'chat', row: 1 },
];

function drawIcon(ctx, type, cx, cy, size) {
  // cx, cy = アイコン中心座標
  // size = 55（半径相当）
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (type) {
    case 'clipboard':
      // クリップボード: 外枠rect + 上部clip + 3本の横線
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.6, cy - size * 0.7, size * 1.2, size * 1.4, 8);
      ctx.stroke();
      // 上部クリップ
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.3, cy - size * 0.85, size * 0.6, size * 0.3, 4);
      ctx.stroke();
      // 横線3本
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.35, cy - size * 0.15 + i * size * 0.3);
        ctx.lineTo(cx + size * 0.35, cy - size * 0.15 + i * size * 0.3);
        ctx.stroke();
      }
      break;

    case 'coin':
      // コイン: 円 + 中央に¥マーク
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      // ¥記号
      ctx.font = `bold ${size * 0.8}px sans-serif`;
      ctx.fillStyle = '#10b981';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('¥', cx, cy);
      break;

    case 'history':
      // 時計: 円 + 針
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      // 時針
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - size * 0.45);
      ctx.stroke();
      // 分針
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
      // 本: 外枠 + 背表紙線 + 横線3本
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.55, cy - size * 0.7, size * 1.1, size * 1.4, 4);
      ctx.stroke();
      // 背表紙
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.2, cy - size * 0.7);
      ctx.lineTo(cx - size * 0.2, cy + size * 0.7);
      ctx.stroke();
      // 横線
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.0, cy - size * 0.3 + i * size * 0.3);
        ctx.lineTo(cx + size * 0.4, cy - size * 0.3 + i * size * 0.3);
        ctx.stroke();
      }
      break;

    case 'chat':
      // 吹き出し: 角丸rect + 尻尾
      ctx.beginPath();
      ctx.roundRect(cx - size * 0.7, cy - size * 0.6, size * 1.4, size * 1.0, 12);
      ctx.stroke();
      // 吹き出し尻尾
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.3, cy + size * 0.4);
      ctx.lineTo(cx - size * 0.5, cy + size * 0.8);
      ctx.lineTo(cx + size * 0.1, cy + size * 0.4);
      ctx.stroke();
      break;
  }
}

// 背景
ctx.fillStyle = '#0a0a0a';
ctx.fillRect(0, 0, WIDTH, HEIGHT);

const cols = 3;
const rows = 2;
const btnW = Math.floor(2500 / cols);  // 833px
const btnH = Math.floor(843 / rows);   // 421px

buttons.forEach((btn, i) => {
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = col * btnW;
  const y = row * btnH;

  // 背景
  ctx.fillStyle = btn.row === 0 ? '#0d1f17' : '#111111';
  ctx.fillRect(x, y, btnW, btnH);

  // 上段: 上部グリーンライン
  if (btn.row === 0) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.fillRect(x, y, btnW, 3);
  }

  // 境界線（右と下）
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 1;
  if (col < cols - 1) {
    ctx.beginPath();
    ctx.moveTo(x + btnW, y);
    ctx.lineTo(x + btnW, y + btnH);
    ctx.stroke();
  }
  if (row < rows - 1) {
    ctx.beginPath();
    ctx.moveTo(x, y + btnH);
    ctx.lineTo(x + btnW, y + btnH);
    ctx.stroke();
  }

  // アイコン中心座標（ボタン中央の少し上）
  const iconCY = y + btnH * 0.38;
  const iconCX = x + btnW / 2;
  drawIcon(ctx, btn.icon, iconCX, iconCY, 55);

  // メインテキスト
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(btn.label, x + btnW / 2, y + btnH * 0.70);
});

// 全体上部グリーンライン
ctx.fillStyle = '#10b981';
ctx.fillRect(0, 0, 2500, 3);

// PNG出力
const outputPath = path.join(__dirname, '../public/richmenu.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);
console.log(`生成完了: ${outputPath} (${buffer.length} bytes)`);
