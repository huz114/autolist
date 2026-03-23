import React from 'react'

/** ひらがなをカタカナに変換（U+3041-U+3096 → U+30A1-U+30F6）、全角スペースは半角に */
export function toKatakana(str: string): string {
  return str
    .replace(/[\u3041-\u3096]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 96))
    .replace(/\u3000/g, ' ')
}

/** {xxx} 形式の未編集プレースホルダーを検出（{会社名}と{担当者名}は自動置換されるため除外） */
export function findUnfilledPlaceholders(text: string): string[] {
  const matches = text.match(/\{[^}]+\}/g) || []
  return matches.filter((m) => m !== '{会社名}' && m !== '{担当者名}')
}

/** 自動入力されるプレースホルダー */
const AUTO_FILL_PLACEHOLDERS = new Set(['{会社名}', '{担当者名}'])

/** テンプレートテキスト内のプレースホルダーを色分けしたReact要素に変換 */
export function renderColorCodedText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /\{[^}]+\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const placeholder = match[0]
    const isAuto = AUTO_FILL_PLACEHOLDERS.has(placeholder)
    parts.push(
      React.createElement('span', {
        key: `${match.index}-${placeholder}`,
        className: `inline-block rounded px-1 py-0.5 text-xs font-semibold ${
          isAuto
            ? 'bg-[#06C755]/15 text-[#06C755] border border-[#06C755]/30'
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
        }`,
      }, placeholder)
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}
