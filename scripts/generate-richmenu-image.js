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
const COLS = 3;
const ROWS = 2;
const CELL_W = Math.floor(WIDTH / COLS);   // 833
const CELL_H = Math.floor(HEIGHT / ROWS);  // 421

const BG_COLOR = '#111111';
const BORDER_COLOR = '#333333';
const TEXT_COLOR = '#FFFFFF';
const SUB_TEXT_COLOR = '#AAAAAA';
const HIGHLIGHT_COLOR = '#1E90FF';

// 6ボタン定義（左上→右下）
const BUTTONS = [
  { emoji: '📋', label: '新しく依頼する' },
  { emoji: '💳', label: '残クレジット確認' },
  { emoji: '📊', label: '依頼履歴' },
  { emoji: '💰', label: 'チャージ' },
  { emoji: '❓', label: '使い方' },
  { emoji: '📞', label: '問い合わせ' },
];

function drawButton(ctx, x, y, w, h, button, index) {
  // セル背景
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(x, y, w, h);

  // ホバー風グラデーション（微妙な上下グラデ）
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // アイコン（絵文字）
  const emojiSize = 110;
  ctx.font = `${emojiSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const centerX = x + w / 2;
  const emojiY = y + h * 0.38;
  ctx.fillText(button.emoji, centerX, emojiY);

  // ラベルテキスト
  const fontSize = 52;
  ctx.font = `bold ${fontSize}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelY = y + h * 0.72;
  ctx.fillText(button.label, centerX, labelY);

  // 下部アクセントライン
  ctx.fillStyle = HIGHLIGHT_COLOR;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x + w * 0.3, y + h - 6, w * 0.4, 3);
  ctx.globalAlpha = 1.0;
}

function drawGrid(ctx) {
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = 2;

  // 縦線（2本）
  for (let col = 1; col < COLS; col++) {
    const x = col * CELL_W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  // 横線（1本）
  ctx.beginPath();
  ctx.moveTo(0, CELL_H);
  ctx.lineTo(WIDTH, CELL_H);
  ctx.stroke();

  // 外枠
  ctx.strokeRect(0, 0, WIDTH, HEIGHT);
}

async function main() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 各ボタンを描画
  BUTTONS.forEach((button, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = col * CELL_W;
    const y = row * CELL_H;
    const w = (col === COLS - 1) ? WIDTH - x : CELL_W;
    const h = (row === ROWS - 1) ? HEIGHT - y : CELL_H;
    drawButton(ctx, x, y, w, h, button, index);
  });

  // グリッド線を最後に描画
  drawGrid(ctx);

  // PNG出力
  const outputPath = path.join(__dirname, '..', 'public', 'richmenu.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ リッチメニュー画像を生成しました: ${outputPath}`);
  console.log(`   サイズ: ${WIDTH} × ${HEIGHT}px`);
  console.log(`   ファイルサイズ: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => {
  console.error('❌ 画像生成エラー:', err);
  process.exit(1);
});
