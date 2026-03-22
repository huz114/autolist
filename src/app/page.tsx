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

export default function Home() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqData = [
    {
      q: "本当に全件フォーム付きですか？",
      a: "はい。AIがGoogle検索で収集した企業の中から、実際に問い合わせフォームが確認できた企業のみを納品します。フォームなしの企業は自動で除外されるため、届いたリストはそのまま送信に使えます。",
    },
    {
      q: "どれくらいで収集できますか？",
      a: "100件あたり1〜2時間が目安です。完了したらメールで通知します。前日の夜に依頼して翌朝送信、といった使い方がスムーズです。",
    },
    {
      q: "リスト業者と何が違いますか？",
      a: "リスト業者のデータは更新頻度が低く、フォームの有無も保証されません。オートリストはAIがリアルタイムでGoogleから収集するため、常に最新情報。さらに全件フォーム付き保証なので、そのままChrome拡張で送信まで完結します。",
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
          <span style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, letterSpacing: "0.08em", marginBottom: 2 }}>フォーム付き企業リスト自動収集</span>
          オート<span>リスト</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Link
            href="/my-lists"
            className="nav-member-link"
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              transition: "all 0.2s",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 6,
              padding: "5px 14px",
              background: "rgba(255,255,255,0.06)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
          >
            会員ログイン
          </Link>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>最初の100件は無料</span>
            <Link href="/register" className="nav-cta">
              100件無料でお試し
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="dot" />
            AI営業リスト自動生成 × LINE・Web対応
          </div>
          <h1>
            移動中に頼んで、<br />
            <em>着いたらリストができてた。</em>
          </h1>
          <p className="hero-sub">
            業種と地域を送るだけ。<br />
            AIがGoogleから企業情報を自動収集。<br />
            届くのは、<strong style={{ color: "var(--text-primary)" }}>全件フォーム付きの企業だけ</strong>。<br />
            リスト収集からフォーム送信まで、一気通貫。<br />
            <strong style={{ color: "var(--accent)" }}>最初の100件は無料。</strong>
          </p>
          <div className="hero-cta-group">
            <Link href="/register" className="btn-primary">
              100件無料でお試し
            </Link>
            <span className="btn-note">登録料無料 · カード不要でお試し · いつでも解約</span>
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
              <div className="stat-num">&yen;10〜</div>
              <div className="stat-label">1件あたりの最安コスト</div>
            </div>
          </div>
          <p className="hero-free-badge" style={{ marginTop: 24, textAlign: "center", fontSize: 15, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.02em" }}>
            🎁 最初の100件は無料で体験できます
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
              { icon: "\uD83D\uDD0D", title: "Googleで1社ずつ調べて", desc: "Excelにコピペする作業が延々と続く", consequence: "月20時間を失い、その分だけ商談のチャンスが減っていく" },
              { icon: "\uD83D\uDCCB", title: "100件買ったのに", desc: "フォームがある会社は半分以下", consequence: "使えないリストに払ったコスト、さらに精査する時間も無駄に" },
              { icon: "\uD83D\uDCB8", title: "リスト業者に頼んだら", desc: "高い・古い・使えない", consequence: "1件¥30〜60、しかもフォームなしが混在。コスパが見えない" },
              { icon: "\uD83D\uDEB6", title: "飛び込み先を探しながら", desc: "街を歩き回る非効率", consequence: "1日回れるのは10〜20社。移動時間が大半を占める" },
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

      {/* COMPARISON */}
      <section className="lp-section comparison-section">
        <div className="container">
          <div className="reveal" ref={addRevealRef}>
            <div className="section-label">Solution</div>
            <h2 className="section-title">
              フォーム付きリストの<br />収集から送信まで、一気通貫。
            </h2>
          </div>
          <div className="comparison-table reveal" ref={addRevealRef}>
            <div className="comparison-header">
              <div style={{ color: "var(--text-muted)" }}>比較項目</div>
              <div className="col-before">&times; 従来の<br />方法</div>
              <div className="col-after">✓ オート<br />リスト</div>
            </div>
            {[
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                ),
                label: "コスト",
                before: <>リスト業者<br />&yen;5〜&yen;60/件</>,
                after: <>&yen;10〜&yen;20/件</>,
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
                label: "フォーム有無",
                before: <>買うまでわからない<br />フォーム無しリスト含む</>,
                after: <>全件フォーム付き<br />確認作業ゼロ</>,
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
                    <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                ),
                label: "送信作業",
                before: <>1件ずつ<br />コピペで<br />手入力</>,
                after: <>Chrome拡張で<br />半自動送信</>,
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                label: "データ鮮度",
                before: <>既存データベース<br />更新頻度は業者依存</>,
                after: <>リアルタイム<br />Google最新情報</>,
              },
              {
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-muted)" }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
                  </svg>
                ),
                label: "最低注文",
                before: <>1,000件単位<br />少量注文不可</>,
                after: <>10件から<br />10件単位で自由</>,
              },
            ].map((row, i) => (
              <div key={i} className="comparison-row">
                <div className="col-item">
                  {row.icon}
                  {row.label}
                </div>
                <div className="col-before">{row.before}</div>
                <div className="col-after">{row.after}</div>
              </div>
            ))}
          </div>
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
                title: "AIが自動で収集",
                desc: "Googleから企業名・URL・電話番号・フォームURLを自動収集。届くのはフォームがある企業だけ。完了したらメールで通知します。",
              },
              {
                num: "03",
                time: "半自動で送信",
                title: "Chrome拡張でフォーム送信",
                desc: <>テンプレートを選んで送信ボタンを押すだけ。Chrome拡張がフォームを自動入力。<br />コピペ地獄から解放されます。</>,
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
                icon: "\uD83E\uDD16",
                title: <>頼んだら、<br />あとは放置でいい。</>,
                desc: "AIが自動でGoogleを検索し収集します。移動中でも、商談中でも関係なし。気づいたら出来上がっています。",
              },
              {
                icon: "\u2705",
                title: <>全件フォーム付き。<br />ハズレなし。</>,
                desc: "他社のリストは買ってみるまでフォームがあるかわからない。オートリストはフォームのある企業だけをお届けします。100件買って100件使える。",
              },
              {
                icon: "\uD83D\uDE80",
                title: <>リストから送信まで、<br />ワンストップ。</>,
                desc: "収集して終わりじゃない。Chrome拡張でフォーム送信まで半自動化。リスト作成・精査・送信を一つのサービスで完結できます。",
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
            🎁 無料登録で、最初の100件はプレゼント！
          </p>
          <div className="pricing-grid" style={{ marginTop: 56 }}>
            {[
              { volume: "100件", price: "2,000", per: "\u00A520 / 件", feature: <>まず試してみたい方に<br />お手頃スタートプラン</>, featured: false },
              { volume: "300件", price: "5,000", per: "\u00A517 / 件", feature: <>週1回の定期リスト収集に<br />ちょうどいいボリューム</>, featured: false },
              { volume: "700件", price: "10,000", per: "\u00A514 / 件", feature: <>本格的に営業活動を<br />スケールさせるなら</>, featured: true },
              { volume: "1,500件", price: "15,000", per: "\u00A510 / 件", feature: <>大量開拓に最適<br />最もお得な大口プラン</>, featured: false },
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
          <div className="faq-list">
            {faqData.map((faq, i) => (
              <details key={i} className={`faq-item reveal${i > 0 ? ` reveal-delay-${i}` : ""}`} ref={addRevealRef}>
                <summary className="faq-question">
                  {faq.q}
                  <span className="faq-icon">+</span>
                </summary>
                <div className="faq-answer-open">
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
