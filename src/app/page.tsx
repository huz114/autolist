"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import "./lp.css";

const LINE_URL = "https://lin.ee/HoBQrsC";

const LINE_ICON = (
  <svg
    className="line-icon"
    viewBox="0 0 24 24"
    fill="white"
    style={{ width: 22, height: 22, display: "inline-block", verticalAlign: "middle" }}
  >
    <path d="M12 2C6.48 2 2 5.92 2 10.72c0 2.9 1.55 5.49 3.98 7.2L5 21l3.15-1.64C9.33 19.77 10.64 20 12 20c5.52 0 10-3.92 10-8.72S17.52 2 12 2zm1.1 11.47l-2.53-2.7-4.94 2.7 5.44-5.77 2.6 2.7 4.87-2.7-5.44 5.77z" />
  </svg>
);

// SVG icons to replace emoji (no-emoji-icons rule)
const IconSearch = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);
const IconClipboard = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);
const IconYenSign = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20V10" /><path d="m4 4 8 8 8-8" /><path d="M8 14h8" /><path d="M8 18h8" />
  </svg>
);
const IconPhone = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconChart = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
  </svg>
);
const IconTarget = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
  </svg>
);
const IconBot = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
  </svg>
);
const IconGift = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }}>
    <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
  </svg>
);

// Inline CTA component for repeating after sections
const SectionCTA = () => (
  <div className="section-cta-wrap">
    <Link href="/register" className="btn-primary btn-section-cta">
      100件無料でお試し
    </Link>
    <span className="section-cta-note">登録料無料 · カード不要 · いつでも解約</span>
  </div>
);

export default function Home() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [expandedSamples, setExpandedSamples] = useState<Set<number>>(new Set([0]));
  const [demoStep, setDemoStep] = useState(0); // 0=input, 1=analyzing, 2=result
  const [dots, setDots] = useState(0);

  const toggleSample = (idx: number) => {
    setExpandedSamples(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };
  const revealRefs = useRef<(HTMLElement | null)[]>([]);
  const revealIndex = useRef(0);

  // Reset reveal index on each render
  revealIndex.current = 0;

  const addRevealRef = useCallback((el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Demo auto-advance
  useEffect(() => {
    const durations = [2500, 1500, 4000];
    const timer = setTimeout(() => {
      setDemoStep(prev => (prev + 1) % 3);
    }, durations[demoStep]);
    return () => clearTimeout(timer);
  }, [demoStep]);

  // Dots animation for analyzing phase
  useEffect(() => {
    if (demoStep !== 1) return;
    const interval = setInterval(() => {
      setDots(prev => (prev + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, [demoStep]);

  useEffect(() => {
    // Delay to ensure all refs are registered after render
    const timer = setTimeout(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
            }
          });
        },
        { threshold: 0.12 }
      );

      revealRefs.current.forEach((el) => {
        if (el) observer.observe(el);
      });

      return () => observer.disconnect();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const faqData = [
    {
      q: "どんな企業情報が取得できますか？",
      a: "企業名・URL・電話番号・フォームURL・代表者名・設立年・従業員数・資本金・事業内容を自動取得します。ただし、企業のWebサイトに情報が掲載されていない場合は空欄となります。",
    },
    {
      q: "フォームがない企業も含まれますか？",
      a: "はい、含まれます。オートリストはフォームの有無に関わらず、条件に合う企業を収集します。フォームURLが見つかった企業にはURLが付与されるので、フォーム営業にもテレアポにも対応できます。",
    },
    {
      q: "CSVダウンロードはできますか？",
      a: "はい。マイリスト画面からCSVをダウンロードできます。CRM・スプレッドシート・その他の営業ツールにそのまま取り込めます。",
    },
    {
      q: "どれくらいで収集できますか？",
      a: "100件あたり1〜2時間が目安です。完了したらメールでお知らせします。LINEから依頼した場合はLINEにも通知が届きます。前日の夜に依頼して翌朝営業開始、といった使い方がスムーズです。",
    },
    {
      q: "リスト業者と何が違いますか？",
      a: "リスト業者のデータは更新頻度が低く、企業の詳細情報は別料金になることが多いです。オートリストはAIがリアルタイムでGoogleから収集するため、常に最新情報。代表者名・従業員数・事業内容まで標準で付属します。",
    },
    {
      q: "追加料金や月額費用はありますか？",
      a: "一切ありません。クレジットを購入した分だけ使う完全使い切り型。月額課金・解約手続きは不要です。実際に収集できた件数分のみ課金される実績課金制です。",
    },
    {
      q: "依頼をキャンセルできますか？",
      a: "はい、マイリスト画面からいつでもキャンセルできます。収集済み分のみの課金で、未収集分のクレジットは消費されません。",
    },
    {
      q: "LINE連携はできますか？",
      a: "はい。無料登録後にLINE友だち追加すれば、移動中にLINEからもリスト依頼ができます。依頼結果はWebから確認できます。",
    },
  ];

  return (
    <>
      {/* NAVBAR */}
      <nav className={`navbar${navScrolled ? " scrolled" : ""}`}>
        <div className="nav-logo">
          <span className="nav-subtitle" style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", fontWeight: 500, letterSpacing: "0.08em", marginBottom: 2 }}>AI企業リスト自動生成</span>
          オート<span>リスト</span>
        </div>
        <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link
            href="/my-lists"
            className="nav-member-link"
            aria-label="会員ログイン"
          >
            <span className="nav-member-text-full">会員ログイン</span>
            <span className="nav-member-text-short">ログイン</span>
          </Link>
          <div className="nav-cta-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span className="nav-free-badge" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>最初の100件は無料</span>
            <Link href="/register" className="nav-cta" aria-label="100件無料でお試し">
              100件無料でお試し
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero-inner hero-two-col">
          <div>
            <div className="hero-badge">
              <span className="dot" />
              企業詳細情報付きAI営業リスト × LINE・Web対応
            </div>
            <h1>
              移動中に頼んで、<br />
              <em>着いたらリストができてた。</em>
            </h1>
            <p className="hero-sub">
              業種と地域を送るだけ。AIがGoogleからリアルタイム収集。<br />
              届くのは、<strong style={{ color: "var(--text-primary)" }}>代表者名・設立年・従業員数まで揃った企業リスト</strong>。<br />
              テレアポにもフォーム営業にも、すぐ使える。<br />
              <strong style={{ color: "var(--accent)" }}>最初の100件は無料。</strong>
            </p>
          </div>

          {/* インタラクティブデモ（右カラム） */}
          <div>
            <div
              onClick={() => setDemoStep(prev => (prev + 1) % 3)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                padding: '20px 24px',
                minHeight: 220,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, fontWeight: 500, textAlign: 'center' }}>
                こんなかんたんに依頼できます
              </div>

              {/* Step 0: Input phase */}
              <div style={{
                opacity: demoStep === 0 ? 1 : 0,
                transform: demoStep === 0 ? 'translateY(0)' : 'translateY(-20px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
                position: demoStep === 0 ? 'relative' : 'absolute',
                top: demoStep === 0 ? undefined : 0,
                left: demoStep === 0 ? undefined : 0,
                right: demoStep === 0 ? undefined : 0,
                padding: demoStep === 0 ? undefined : '20px 24px',
                pointerEvents: demoStep === 0 ? 'auto' : 'none',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 999,
                  padding: '10px 12px 10px 20px',
                  gap: 10,
                }}>
                  <span style={{ flex: 1, fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>
                    渋谷区の不動産会社 30件
                  </span>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#06C755',
                    flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 10, textAlign: 'center' }}>
                  例: 港区の税理士事務所 50件
                </div>
              </div>

              {/* Step 1: Analyzing phase */}
              <div style={{
                opacity: demoStep === 1 ? 1 : 0,
                transition: 'opacity 0.4s ease',
                position: demoStep === 1 ? 'relative' : 'absolute',
                top: demoStep === 1 ? undefined : 0,
                left: demoStep === 1 ? undefined : 0,
                right: demoStep === 1 ? undefined : 0,
                padding: demoStep === 1 ? undefined : '20px 24px',
                pointerEvents: demoStep === 1 ? 'auto' : 'none',
                display: 'flex',
                flexDirection: 'column' as const,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 120,
              }}>
                <div style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 8,
                }}>
                  AIが解析中{'.'.repeat(dots)}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#06C755',
                      opacity: dots % 3 === i ? 1 : 0.3,
                      transition: 'opacity 0.3s ease',
                    }} />
                  ))}
                </div>
              </div>

              {/* Step 2: Result phase */}
              <div style={{
                opacity: demoStep === 2 ? 1 : 0,
                transition: 'opacity 0.4s ease',
                position: demoStep === 2 ? 'relative' : 'absolute',
                top: demoStep === 2 ? undefined : 0,
                left: demoStep === 2 ? undefined : 0,
                right: demoStep === 2 ? undefined : 0,
                padding: demoStep === 2 ? undefined : '20px 24px',
                pointerEvents: demoStep === 2 ? 'auto' : 'none',
              }}>
                {[
                  { label: '業種', value: '不動産会社', delay: 0 },
                  { label: '地域', value: '渋谷区', delay: 150 },
                  { label: '件数', value: '30件', delay: 300 },
                ].map((field, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '10px 14px',
                    marginBottom: 8,
                    opacity: demoStep === 2 ? 1 : 0,
                    transform: demoStep === 2 ? 'translateX(0)' : 'translateX(-20px)',
                    transition: `opacity 0.4s ease ${field.delay}ms, transform 0.4s ease ${field.delay}ms`,
                  }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{field.label}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{field.value}</div>
                  </div>
                ))}
                <Link
                  href="/register"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    background: '#06C755',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 15,
                    padding: '14px 0',
                    borderRadius: 12,
                    textDecoration: 'none',
                    marginTop: 8,
                    opacity: demoStep === 2 ? 1 : 0,
                    transform: demoStep === 2 ? 'scale(1)' : 'scale(0.9)',
                    transition: 'opacity 0.4s ease 450ms, transform 0.4s ease 450ms, background 0.2s',
                  }}
                >
                  🚀 収集スタート（無料）
                </Link>
              </div>
            </div>
          </div>
          <div className="hero-stats">
            <div>
              <div className="stat-num">1分</div>
              <div className="stat-label">依頼するだけ</div>
            </div>
            <div>
              <div className="stat-num">10件〜</div>
              <div className="stat-label">10件単位で自由に指定</div>
            </div>
            <div>
              <div className="stat-num">&yen;6.4〜</div>
              <div className="stat-label">1件あたりの最安コスト</div>
            </div>
          </div>
          <p className="hero-free-badge" style={{ marginTop: 24, textAlign: "center", fontSize: 16, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.02em" }}>
            <IconGift /> 最初の100件は無料で体験できます
          </p>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="lp-section problem-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef}>
            <div className="section-label">Problem</div>
            <h2 className="section-title">
              毎朝1時間、そのリスト作りは<br />「営業の仕事」ですか？
            </h2>
          </div>
          <div className="problem-grid">
            {[
              { icon: <IconSearch />, title: "Googleで1社ずつ調べて", desc: "企業名・電話番号・担当者名...Excelに手入力する作業が延々と続く", consequence: "月20時間を失い、その分だけ商談のチャンスが減っていく" },
              { icon: <IconClipboard />, title: "買ったリストが使えない", desc: "電話番号が古い、担当者名がない、事業内容が不明", consequence: "リストの精査にさらに時間を取られ、結局自分で調べ直す羽目に" },
              { icon: <IconYenSign />, title: "リスト業者に頼んだら", desc: "高い・古い・情報が足りない", consequence: "1件¥5〜60。しかも代表者名や従業員数は別料金。コスパが見えない" },
              { icon: <IconPhone />, title: "テレアポ前の下調べが重い", desc: "会社の規模感も事業内容もわからず電話するのは怖い", consequence: "準備不足のまま架電 → 的外れなトーク → アポが取れない悪循環" },
            ].map((item, i) => (
              <div key={i} className={`problem-card reveal reveal-delay-${i + 1}`} ref={addRevealRef}>
                <div className="problem-icon">{item.icon}</div>
                <div className="problem-text">
                  <div className="problem-desc">
                    <strong>{item.title}</strong>
                    {item.desc}
                  </div>
                  <span className="problem-consequence">→ {item.consequence}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA after Problem */}
      <SectionCTA />

      {/* COMPARISON */}
      <section className="lp-section comparison-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef}>
            <div className="section-label">Solution</div>
            <h2 className="section-title">
              企業詳細情報付きのリストが、<br />この価格で手に入る。
            </h2>
          </div>
          <div className="comparison-table reveal" ref={addRevealRef} role="table" aria-label="従来の方法とオートリストの比較">
            <div className="comparison-header" role="row">
              <div style={{ color: "var(--text-muted)" }} role="columnheader">比較項目</div>
              <div className="col-before" role="columnheader">&times; リスト<br />業者</div>
              <div className="col-after" role="columnheader">✓ オート<br />リスト</div>
            </div>
            {[
              {
                label: "コスト",
                before: <>¥5〜60/件</>,
                after: <>¥6.4〜9.9/件</>,
              },
              {
                label: "情報の充実度",
                before: <>企業名とURLだけ<br />詳細は別料金</>,
                after: <>代表者名・設立年・従業員数<br />資本金・事業内容まで標準付属</>,
              },
              {
                label: "データ形式",
                before: <>PDF・独自フォーマット<br />加工に手間</>,
                after: <>CSVダウンロード<br />CRM・スプレッドシートにそのまま</>,
              },
              {
                label: "電話番号",
                before: <>載っていない or 古い</>,
                after: <>AIがリアルタイムで収集<br />テレアポにすぐ使える</>,
              },
              {
                label: "フォームURL",
                before: <>買うまでわからない<br />フォーム無し混在</>,
                after: <>フォームがある企業は<br />URL付きで納品</>,
              },
              {
                label: "データ鮮度",
                before: <>既存DB<br />更新頻度は業者依存</>,
                after: <>リアルタイムで<br />Googleから最新情報を収集</>,
              },
              {
                label: "最低注文",
                before: <>1,000件単位<br />少量注文不可</>,
                after: <>10件から<br />10件単位で自由</>,
              },
            ].map((row, i) => (
              <div key={i} className="comparison-row" role="row">
                <div className="col-item" role="cell">
                  {row.label}
                </div>
                <div className="col-before" role="cell">{row.before}</div>
                <div className="col-after" role="cell">{row.after}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATA SAMPLE */}
      <section className="lp-section data-sample-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef}>
            <div className="section-label">Sample</div>
            <h2 className="section-title">届くリストのサンプル</h2>
          </div>
          <div className="reveal" ref={addRevealRef} style={{ maxWidth: 720, margin: '0 auto' }}>
            {[
              {
                name: '株式会社サンプルテック',
                badges: [
                  { label: 'フォームあり', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
                  { label: '電話あり', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                  { label: '採用中', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
                  { label: '広告出稿中', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
                ],
                industry: 'Webマーケティング支援',
                location: '東京都渋谷区',
                domain: 'https://sample-tech.co.jp',
                phone: '03-XXXX-XXXX',
                representative: '山田 太郎',
                email: 'info@sample-tech.co.jp',
                description: 'Webマーケティング支援、SEO対策、広告運用代行',
                details: {
                  established: '2015年',
                  employees: '25名',
                  capital: '1,000万円',
                  industryCategory: '情報通信業 > インターネット附随サービス業',
                  sns: ['X', 'Instagram', 'Facebook'],
                  tags: ['Webマーケティング', 'SEO', '広告運用', 'デジタルマーケ', 'コンサル'],
                  officers: '代表取締役 山田太郎 / 取締役 佐藤花子',
                },
              },
              {
                name: '合同会社サンプルクリエイト',
                badges: [
                  { label: 'フォームなし', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
                  { label: '電話あり', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                ],
                industry: 'IT導入コンサルティング',
                location: '大阪府大阪市',
                domain: 'https://create-llc.co.jp',
                phone: '06-XXXX-XXXX',
                representative: '佐藤 花子',
                email: null,
                description: 'IT導入コンサルティング、業務改善支援',
                details: {
                  established: '2019年',
                  employees: '8名',
                  capital: '500万円',
                  industryCategory: '情報通信業 > 情報処理・提供サービス業',
                  sns: [] as string[],
                  tags: ['IT導入', 'DX', 'コンサル', '業務改善'],
                  officers: null as string | null,
                },
              },
              {
                name: '株式会社サンプルフォース',
                badges: [
                  { label: 'フォームあり', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
                  { label: '電話あり', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
                  { label: '採用中', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
                ],
                industry: '製造業向けシステム開発',
                location: '愛知県名古屋市',
                domain: 'https://sample-force.co.jp',
                phone: '052-XXX-XXXX',
                representative: '鈴木 一郎',
                email: 'contact@sample-force.co.jp',
                description: '製造業向け生産管理システムの開発・導入支援',
                details: {
                  established: '2010年',
                  employees: '50名',
                  capital: '3,000万円',
                  industryCategory: '情報通信業 > ソフトウェア業',
                  sns: ['YouTube'],
                  tags: ['製造業', '生産管理', 'システム開発', 'DX', 'IoT'],
                  officers: '代表取締役 鈴木一郎',
                },
              },
            ].map((company, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 16,
                  padding: '20px 24px',
                  marginBottom: 12,
                }}
              >
                {/* Layer 1 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{company.name}</span>
                  {company.badges.map((badge, bi) => (
                    <span
                      key={bi}
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 600,
                        color: badge.color,
                        background: badge.bg,
                        borderRadius: 999,
                        padding: '2px 8px',
                        lineHeight: '16px',
                      }}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {company.industry}　{company.location}
                </div>
                <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 10 }}>
                  {company.domain}
                </div>
                {/* Contact grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>電話番号</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{company.phone}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>代表者名</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{company.representative}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>メール</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{company.email || '-'}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  {company.description}
                </div>
                {/* Toggle button */}
                <button
                  onClick={() => toggleSample(idx)}
                  style={{
                    fontSize: 12,
                    color: '#06C755',
                    cursor: 'pointer',
                    background: 'rgba(6,199,85,0.08)',
                    border: '1px solid rgba(6,199,85,0.25)',
                    borderRadius: 999,
                    padding: '6px 16px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    width: '100%',
                  }}
                >
                  {expandedSamples.has(idx) ? '詳細を閉じる ▲' : '詳細を見る ▼'}
                </button>
                {/* Layer 2 */}
                {expandedSamples.has(idx) && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* 基本情報 */}
                    <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#6b7280', marginBottom: 6 }}>基本情報</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      <span>設立: {company.details.established}</span>
                      <span>従業員: {company.details.employees}</span>
                      <span>資本金: {company.details.capital}</span>
                    </div>
                    {/* 業種分類 */}
                    <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#6b7280', marginBottom: 6 }}>業種分類</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                      {company.details.industryCategory}
                    </div>
                    {/* SNS */}
                    {company.details.sns.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#6b7280', marginBottom: 6 }}>SNS</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          {company.details.sns.map((s, si) => (
                            <span key={si} style={{ fontSize: 11, color: '#8494a7', background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '2px 10px' }}>{s}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {/* 検索タグ */}
                    <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#6b7280', marginBottom: 6 }}>検索タグ</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {company.details.tags.map((tag, ti) => (
                        <span key={ti} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: '2px 10px', fontSize: 11, color: '#8494a7' }}>{tag}</span>
                      ))}
                    </div>
                    {/* 役員 */}
                    {company.details.officers && (
                      <>
                        <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#6b7280', marginBottom: 6 }}>役員</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {company.details.officers}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="data-sample-note">
            ※ サンプル表示用の架空データです。企業Webサイトに情報が掲載されていない項目は空欄となります。
          </p>
        </div>
      </section>

      {/* STEPS */}
      <section className="lp-section steps-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef} style={{ textAlign: "center" }}>
            <div className="section-label">How It Works</div>
            <h2 className="section-title">使い方3ステップ</h2>
          </div>
          <div className="steps-grid">
            {[
              {
                num: "01",
                time: "わずか10秒",
                title: "リストを依頼",
                desc: "業種と地域と件数を入力して依頼するだけ。Webから直接、またはLINE連携で移動中にも。",
              },
              {
                num: "02",
                time: "依頼したら放置でOK",
                title: "AIが自動で収集・精査",
                desc: "Googleから企業名・URL・電話番号・フォームURLを収集。さらに代表者名・設立年・従業員数・資本金・事業内容をAIが自動取得。完了したらメールでお知らせ。LINEから依頼した場合はLINEにも通知。",
              },
              {
                num: "03",
                time: "すぐ営業開始",
                title: "CSVダウンロードで即活用",
                desc: "完成したリストはCSVでダウンロード。CRMやスプレッドシートにそのまま取り込めます。Chrome拡張を使えば、フォーム送信も半自動化。",
              },
            ].map((step, i) => (
              <div key={i} className={`step-card reveal reveal-delay-${i + 1}`} ref={addRevealRef}>
                <div className="step-num">{step.num}</div>
                <div className="step-time">{step.time}</div>
                <div className="step-title">{step.title}</div>
                <p className="step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 32, fontSize: 13, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.8 }}>
            ※ 1回の依頼は最大100件までです（10件単位で指定可能）<br />
            ※ 依頼した件数に満たなかった場合、実際に収集できた<br />件数分のみの課金となります
          </p>
        </div>
      </section>

      {/* CTA after Steps */}
      <SectionCTA />

      {/* BENEFITS */}
      <section className="lp-section benefits-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef} style={{ textAlign: "center" }}>
            <div className="section-label">Benefits</div>
            <h2 className="section-title">なぜ、オートリストが<br />選ばれるのか</h2>
          </div>
          <div className="benefits-grid">
            {[
              {
                icon: <IconChart />,
                title: <>企業名だけじゃない。<br />中身がわかる。</>,
                desc: "代表者名・設立年・従業員数・資本金・事業内容。営業に必要な情報をAIが自動で取得。テレアポの下調べも、提案書の準備も、リストを開くだけで済みます。",
              },
              {
                icon: <IconTarget />,
                title: <>1つのリストで、<br />2つの営業手法。</>,
                desc: "電話番号でテレアポ。フォームURLでフォーム営業。同じリストからどちらの手法にも展開できます。CSVダウンロードで、お使いのCRMやスプレッドシートにそのまま。",
              },
              {
                icon: <IconBot />,
                title: <>頼んだら、<br />あとは放置でいい。</>,
                desc: "AIが自動でGoogleを検索し、企業情報を収集・精査します。移動中でも、商談中でも関係なし。気づいたら出来上がっています。",
              },
            ].map((item, i) => (
              <div key={i} className={`benefit-card reveal reveal-delay-${i + 1}`} ref={addRevealRef}>
                <div className="benefit-icon-wrap">{item.icon}</div>
                <div className="benefit-title">{item.title}</div>
                <p className="benefit-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI / BEFORE-AFTER */}
      <section className="lp-section roi-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef} style={{ textAlign: "center" }}>
            <div className="section-label">ROI</div>
            <h2 className="section-title">
              リスト作成にかけていた時間、<br />計算したことがありますか？
            </h2>
          </div>
          <div className="roi-table reveal" ref={addRevealRef} role="table" aria-label="Before / After 比較">
            <div className="roi-header" role="row">
              <div style={{ color: "var(--text-muted)" }} role="columnheader">項目</div>
              <div className="roi-col-before" role="columnheader">&times; Before</div>
              <div className="roi-col-after" role="columnheader">✓ After</div>
            </div>
            {[
              {
                label: "リスト作成",
                before: "毎朝1時間 × 月20日 = 月20時間",
                after: "依頼10秒。あとは自動。",
              },
              {
                label: "1件あたりの情報",
                before: "企業名とURLだけ",
                after: "代表者名・電話番号・従業員数・事業内容まで",
              },
              {
                label: "リスト単価",
                before: "¥5〜60/件（業者）or 人件費換算¥500/件以上",
                after: "¥6.4〜9.9/件",
              },
              {
                label: "月の営業時間",
                before: "160時間のうち20時間がリスト作成",
                after: "160時間まるごと営業活動に",
              },
            ].map((row, i) => (
              <div key={i} className="roi-row" role="row">
                <div className="roi-col-item" role="cell">{row.label}</div>
                <div className="roi-col-before" role="cell">{row.before}</div>
                <div className="roi-col-after" role="cell">{row.after}</div>
              </div>
            ))}
          </div>
          <p className="roi-note">
            ※ 上記は1日100件を手作業で作成する場合の概算です。実際の効果は業務内容により異なります。
          </p>
        </div>
      </section>

      {/* CTA after ROI */}
      <SectionCTA />

      {/* PRICING */}
      <section id="pricing" className="lp-section pricing-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef} style={{ textAlign: "center" }}>
            <div className="section-label">Pricing</div>
            <h2 className="section-title">使った分だけ。<br />月額なし、解約なし。</h2>
            <p className="section-sub" style={{ margin: "0 auto 0", textAlign: "center" }}>
              クレジットを購入した分だけ使う、<br />完全使い切り型。<br />無駄なコストは一切かかりません。
            </p>
          </div>
          <p style={{ marginTop: 24, textAlign: "center", fontSize: 16, color: "var(--accent)", fontWeight: 700 }}>
            <IconGift /> 無料登録で、最初の100件はプレゼント！
          </p>
          <div className="pricing-grid" style={{ marginTop: 56 }}>
            {[
              { volume: "200件", price: "1,980", per: "\u00A59.9 / 件", feature: <>まず試してみたい方に</>, featured: false },
              { volume: "500件", price: "3,980", per: "\u00A58.0 / 件", feature: <>週1回の定期収集にちょうどいい</>, featured: false },
              { volume: "1,000件", price: "6,980", per: "\u00A57.0 / 件", feature: <>本格的に営業を<br />スケールさせるなら</>, featured: true },
              { volume: "2,000件", price: "12,800", per: "\u00A56.4 / 件", feature: <>大量開拓に最適<br />最もお得</>, featured: false },
            ].map((plan, i) => (
              <div
                key={i}
                className={`pricing-card${plan.featured ? " featured" : ""} reveal reveal-delay-${i + 1}`}
                ref={addRevealRef}
              >
                {plan.featured && <div className="pricing-badge">★ おすすめ</div>}
                <div className="pricing-volume">{plan.volume}</div>
                <div className="pricing-price">
                  <sup>&yen;</sup>{plan.price}
                </div>
                <div className="pricing-per">{plan.per}</div>
                <div className="pricing-divider" />
                <div className="pricing-feature">{plan.feature}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section faq-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef} style={{ textAlign: "center" }}>
            <div className="section-label">FAQ</div>
            <h2 className="section-title">よくある質問</h2>
          </div>
          <div className="faq-list" role="region" aria-label="よくある質問">
            {faqData.map((faq, i) => (
              <details
                key={i}
                className={`faq-item reveal${i > 0 ? ` reveal-delay-${i}` : ""}`}
                ref={addRevealRef}
                onToggle={(e) => {
                  const details = e.currentTarget as HTMLDetailsElement;
                  const summary = details.querySelector("summary");
                  if (summary) {
                    summary.setAttribute("aria-expanded", String(details.open));
                  }
                }}
              >
                <summary
                  className="faq-question"
                  role="button"
                  aria-expanded="false"
                  aria-controls={`faq-answer-${i}`}
                >
                  {faq.q}
                  <span className="faq-icon" aria-hidden="true">+</span>
                </summary>
                <div className="faq-answer-open" id={`faq-answer-${i}`} role="region">
                  <p>{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="lp-section final-cta-section" id="final-cta">
        <div className="container">
          <div className="final-cta-inner reveal" ref={addRevealRef}>
            <div className="section-label" style={{ textAlign: "center" }}>Get Started</div>
            <h2 className="final-cta-title">
              営業の時間を、営業に使う。
            </h2>
            <p className="final-cta-sub">最初の100件は無料。<br />月額なし、いつでも始められます。</p>
            <div className="final-cta-group">
              <Link
                href="/register"
                className="btn-primary"
                style={{ fontSize: 17, padding: "20px 40px" }}
              >
                100件無料でお試し
              </Link>
            </div>
            <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
              登録料無料 &middot; クレジットカード不要でお試し &middot; いつでも解約
            </p>
          </div>
        </div>
      </section>

      {/* MOBILE STICKY CTA */}
      <div className="sticky-cta-mobile" aria-label="100件無料でお試し">
        <Link href="/register" className="btn-primary sticky-cta-btn">
          100件無料でお試し
        </Link>
      </div>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="footer-logo">
          オート<span>リスト</span>
        </div>
        <p>
          <Link href="/legal/terms">利用規約</Link> &nbsp;|&nbsp;
          <Link href="/legal/privacy">プライバシーポリシー</Link> &nbsp;|&nbsp;
          <Link href="/legal/tokushoho">特定商取引法に基づく表記</Link> &nbsp;|&nbsp;
          <Link href="/legal/company">運営者情報</Link>
        </p>
        <p style={{ marginTop: 12 }}>powered by シリョログ &nbsp;&copy; 2026 AI&apos;ll All rights reserved.</p>
      </footer>
    </>
  );
}
