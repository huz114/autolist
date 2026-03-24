'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * モーダル用フォーカストラップ hook
 * - Tab/Shift+Tab でモーダル内のフォーカス可能な要素のみを循環
 * - Esc キーでモーダルを閉じる
 * - モーダル表示時に最初のフォーカス可能な要素にフォーカス
 */
export function useFocusTrap(isOpen: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const getFocusableElements = useCallback(() => {
    if (!ref.current) return []
    const elements = ref.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    return Array.from(elements).filter(
      (el) => el.offsetParent !== null // visible only
    )
  }, [])

  useEffect(() => {
    if (!isOpen) return

    // 開く前のフォーカスを保存
    previousFocusRef.current = document.activeElement as HTMLElement

    // 最初のフォーカス可能な要素にフォーカス
    const timer = requestAnimationFrame(() => {
      const focusable = getFocusableElements()
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        ref.current?.focus()
      }
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      // IME入力中はスキップ
      if (e.isComposing || e.keyCode === 229) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(timer)
      document.removeEventListener('keydown', handleKeyDown)
      // モーダルを閉じたら元の要素にフォーカスを戻す
      previousFocusRef.current?.focus()
    }
  }, [isOpen, onClose, getFocusableElements])

  return ref
}
