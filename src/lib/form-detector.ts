// フォーム検出器
// 会社概要ページ＋既知のコンタクトパスを探索し、問い合わせフォームの有無と種類を判定

import * as cheerio from "cheerio";

export interface FormDetectionResult {
  has_form: boolean;
  form_url: string | null;
  form_type: "document_request" | "estimate" | "recruit" | "inquiry" | "contact" | "other" | null;
}

/** ユーザーエージェント */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 問い合わせ系パス（既知パターン） */
const CONTACT_PATHS = [
  "/contact",
  "/contact/",
  "/inquiry",
  "/inquiry/",
  "/contact.html",
  "/form",
  "/form/",
  "/toiawase",
  "/toiawase/",
  "/otoiawase",
  "/otoiawase/",
];

/** お問い合わせリンクの検索キーワード */
const CONTACT_LINK_KEYWORDS = [
  "お問い合わせ",
  "お問合せ",
  "問い合わせ",
  "問合せ",
  "お問合わせ",
  "contact",
  "inquiry",
  "資料請求",
  "見積もり",
  "見積り",
  "お見積",
];

// ─── フォーム判定強化用定数（修正3） ─────────────────────────────────────────

/**
 * 問い合わせフォームとして有効と判断するための input name 属性キーワード
 * （メール・電話・氏名・会社名・本文などを示す名前）
 */
const VALID_INPUT_NAME_KEYWORDS: ReadonlyArray<string> = [
  'name', 'company', 'message', 'content', 'body', 'inquiry',
  'お名前', '会社', 'メッセージ', 'mail', 'email', 'tel', 'phone',
  'subject', 'comment', 'question',
];

/**
 * action 属性に含まれている場合「検索フォーム」とみなすキーワード
 */
const SEARCH_ACTION_KEYWORDS: ReadonlyArray<string> = [
  'search', 'find', 'query',
];

/**
 * <form> 要素が問い合わせ・申し込みフォームとして有効かどうかを判定する。
 *
 * 条件A: <form> 内に type="email" / type="tel" / <textarea> /
 *         または name 属性が VALID_INPUT_NAME_KEYWORDS に合致する <input> が存在する
 * 条件B: action 属性が存在しない、または action が検索フォームっぽくない
 *         （action に "search" / "find" / "query" を含まない）
 *         さらに action に "?q=" を含まない
 *
 * 両条件を満たす <form> が 1 つ以上存在すれば true を返す。
 */
function hasValidContactForm($: ReturnType<typeof import("cheerio").load>): boolean {
  const forms = $('form');
  let found = false;

  forms.each((_i, formEl) => {
    if (found) return; // 既に発見済みならスキップ

    const $form = $(formEl);
    const action = ($form.attr('action') || '').toLowerCase();

    // 条件B: 検索フォームっぽい action を持つ場合は除外
    const isSearchForm =
      SEARCH_ACTION_KEYWORDS.some(kw => action.includes(kw)) ||
      action.includes('?q=');
    if (isSearchForm) return;

    // 条件A: 有効な入力フィールドの確認
    // type="email"
    if ($form.find('input[type="email"]').length > 0) {
      found = true;
      return;
    }
    // type="tel"
    if ($form.find('input[type="tel"]').length > 0) {
      found = true;
      return;
    }
    // <textarea>
    if ($form.find('textarea').length > 0) {
      found = true;
      return;
    }
    // name 属性キーワード一致の <input>
    $form.find('input[name], select[name], textarea[name]').each((_j, inputEl) => {
      if (found) return;
      const nameAttr = ($(inputEl).attr('name') || '').toLowerCase();
      if (VALID_INPUT_NAME_KEYWORDS.some(kw => nameAttr.includes(kw.toLowerCase()))) {
        found = true;
      }
    });
  });

  return found;
}
// ──────────────────────────────────────────────────────────────────────────────

/** フォーム種別判定キーワード */
const FORM_TYPE_KEYWORDS: Array<{
  type: FormDetectionResult["form_type"];
  keywords: string[];
}> = [
  {
    type: "document_request",
    keywords: ["資料請求", "資料ダウンロード", "カタログ請求", "資料のご請求"],
  },
  {
    type: "estimate",
    keywords: ["見積もり", "見積り", "お見積", "見積依頼", "見積"],
  },
  {
    type: "recruit",
    keywords: ["採用", "求人", "エントリー", "応募", "リクルート"],
  },
  {
    type: "inquiry",
    keywords: ["お問い合わせ", "お問合せ", "問い合わせ", "inquiry"],
  },
  { type: "contact", keywords: ["contact", "連絡", "ご相談", "ご連絡"] },
];

/** SSL/TLSエラーコード */
const SSL_ERROR_CODES: ReadonlyArray<string> = [
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "ERR_CERT_COMMON_NAME_INVALID",
  "CERT_NOT_YET_VALID",
  "ERR_SSL_PROTOCOL_ERROR",
];

/** 404ページ検出キーワード */
const NOT_FOUND_KEYWORDS: ReadonlyArray<string> = [
  "ページが見つかりません",
  "ページが見つかりませんでした",
  "お探しのページは見つかりませんでした",
  "404 not found",
  "page not found",
  "not found",
  "ページは存在しません",
  "ページは削除されました",
];

/**
 * SSL/TLSエラーかどうかを判定
 */
function isSslError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as Record<string, unknown>;
  const code = String(err.code || "");
  const message = String(err.message || "").toUpperCase();
  return SSL_ERROR_CODES.some(
    (sslCode) => code.includes(sslCode) || message.includes(sslCode)
  );
}

/**
 * ページが404コンテンツかどうかを判定
 * （ステータス200でも本文が404ページの場合がある：ソフト404）
 */
function isSoft404Page(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  // <title>タグ内に404キーワードがあるか
  const titleMatch = lowerHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  const titleText = titleMatch ? titleMatch[1].toLowerCase() : "";

  // タイトルに404キーワードがある場合は高確率で404
  if (NOT_FOUND_KEYWORDS.some((kw) => titleText.includes(kw.toLowerCase()))) {
    return true;
  }

  // 本文に404キーワードがあり、かつ<form>タグがない場合
  const hasNotFoundText = NOT_FOUND_KEYWORDS.some((kw) =>
    lowerHtml.includes(kw.toLowerCase())
  );
  const hasFormTag = lowerHtml.includes("<form");

  if (hasNotFoundText && !hasFormTag) {
    return true;
  }

  return false;
}

/**
 * HEADリクエストでURLの存在を確認（5秒タイムアウト）
 */
async function headCheck(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    return response.ok;
  } catch (error) {
    if (isSslError(error)) {
      console.log(`[form-detector] SSL error for ${url}: ${(error as Error).message}`);
    }
    return false;
  }
}

/**
 * GETリクエストでHTMLを取得（15秒タイムアウト）
 */
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    // HTTPステータスコードチェック（200系以外は除外）
    if (!response.ok) {
      console.log(
        `[form-detector] HTTP ${response.status} for ${url} — skipping`
      );
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return null;
    }

    let html = await response.text();
    html = html.length > 1_000_000 ? html.substring(0, 1_000_000) : html;

    // ソフト404検出（ステータス200だが本文が404ページ）
    if (isSoft404Page(html)) {
      console.log(
        `[form-detector] Soft 404 detected for ${url} — skipping`
      );
      return null;
    }

    return html;
  } catch (error) {
    if (isSslError(error)) {
      console.log(
        `[form-detector] SSL/TLS error for ${url}: ${(error as Error).message} — skipping`
      );
    } else {
      console.log(
        `[form-detector] Fetch error for ${url}: ${(error as Error).message}`
      );
    }
    return null;
  }
}

/**
 * HTMLからフォームの種別を判定
 */
function classifyFormType(
  html: string,
  url: string
): FormDetectionResult["form_type"] {
  const fullText = html.toLowerCase() + " " + url.toLowerCase();

  for (const { type, keywords } of FORM_TYPE_KEYWORDS) {
    for (const kw of keywords) {
      if (fullText.includes(kw.toLowerCase())) {
        return type;
      }
    }
  }

  return "other";
}

/**
 * 概要ページHTMLからお問い合わせリンクを探す
 */
function findContactLinkInHtml(
  html: string,
  baseDomain: string
): string | null {
  const $ = cheerio.load(html);

  // すべての <a> タグを走査
  const links = $("a");
  for (let i = 0; i < links.length; i++) {
    const el = links.eq(i);
    const href = el.attr("href");
    const text = el.text().trim();

    if (!href) continue;

    // リンクテキストがキーワードを含むか
    const textMatch = CONTACT_LINK_KEYWORDS.some(
      (kw) => text.includes(kw) || (href && href.toLowerCase().includes(kw.toLowerCase()))
    );

    if (!textMatch) continue;

    // 相対URLを絶対URLに変換
    try {
      const baseUrl = `https://${baseDomain}`;
      const absoluteUrl = new URL(href, baseUrl).toString();
      // 同一ドメインのリンクのみ対象
      if (absoluteUrl.includes(baseDomain)) {
        return absoluteUrl;
      }
    } catch {
      // 不正なURL — スキップ
    }
  }

  return null;
}

/**
 * フォームを検出
 *
 * 1. 概要ページHTMLからお問い合わせリンクを探索
 * 2. 既知パスをHEAD探索
 * 3. 見つかったページを取得し <form> の有無を確認
 * 4. フォーム種別を判定
 */
export async function detectContactForm(
  domain: string,
  overviewHtml: string
): Promise<FormDetectionResult> {
  const baseUrl = `https://${domain}`;

  // ステップ1: 概要ページHTML内のリンクから探す
  const linkedUrl = findContactLinkInHtml(overviewHtml, domain);
  if (linkedUrl) {
    const html = await fetchHtml(linkedUrl);
    if (html) {
      const $ = cheerio.load(html);
      // 厳密なフォーム判定（修正3: 条件A + 条件B）
      if (hasValidContactForm($)) {
        return {
          has_form: true,
          form_url: linkedUrl,
          form_type: classifyFormType(html, linkedUrl),
        };
      }
    }
  }

  // ステップ2: 既知パスを探索
  for (const path of CONTACT_PATHS) {
    const url = `${baseUrl}${path}`;
    const exists = await headCheck(url);
    if (exists) {
      const html = await fetchHtml(url);
      if (html) {
        const $ = cheerio.load(html);
        // 厳密なフォーム判定（修正3: 条件A + 条件B）
        if (hasValidContactForm($)) {
          return {
            has_form: true,
            form_url: url,
            form_type: classifyFormType(html, url),
          };
        }
        // <form>タグがないページはフォームなしと判定
        // （電話番号のみの問い合わせページ等の誤検出を防止）
        // 次のパスを試すためにcontinue
        continue;
      }
    }
  }

  // ステップ3: 概要ページ自体に有効な <form> があるか確認
  // form_url は null ではなくトップページURL（baseUrl）を返す（修正3: 補足修正）
  {
    const $ = cheerio.load(overviewHtml);
    if (hasValidContactForm($)) {
      return {
        has_form: true,
        form_url: baseUrl,
        form_type: classifyFormType(overviewHtml, baseUrl),
      };
    }
  }

  return {
    has_form: false,
    form_url: null,
    form_type: null,
  };
}
