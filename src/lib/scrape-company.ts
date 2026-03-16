// 企業情報クローリング
// 企業サイトにアクセスして会社情報を取得し、フォームの有無も判定する

import { GoogleGenerativeAI } from "@google/generative-ai";
import { detectContactForm } from "./form-detector";

/** 法人格キーワード */
const CORPORATION_KEYWORDS = [
  "株式会社",
  "合同会社",
  "有限会社",
  "一般社団法人",
  "一般財団法人",
  "特定非営利活動法人",
  "NPO法人",
  "医療法人",
  "学校法人",
  "社会福祉法人",
];

/** 法人格キーワードが含まれるか確認 */
function hasCorporationKeyword(name: string): boolean {
  return CORPORATION_KEYWORDS.some((kw) => name.includes(kw));
}

/**
 * HTMLから法人名を抽出する（ルールベース）
 * 優先順位: JSON-LD → og:site_name → フッター著作権
 */
function extractCompanyNameFromHtml(html: string): string | null {
  // 1. JSON-LD の Organization.name
  const scriptMatches = Array.from(
    html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  );
  for (const match of scriptMatches) {
    try {
      const json = JSON.parse(match[1]);
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (
          item["@type"] === "Organization" &&
          typeof item.name === "string"
        ) {
          const name = item.name.trim();
          if (hasCorporationKeyword(name)) {
            return name;
          }
        }
      }
    } catch {
      // JSON parse失敗は無視
    }
  }

  // 2. og:site_name
  const ogMatch = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogMatch) {
    const name = ogMatch[1].trim();
    if (hasCorporationKeyword(name)) {
      return name;
    }
  }
  // property と content の順序が逆の場合
  const ogMatchReverse = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i
  );
  if (ogMatchReverse) {
    const name = ogMatchReverse[1].trim();
    if (hasCorporationKeyword(name)) {
      return name;
    }
  }

  // 3. フッター著作権表記
  const copyrightMatch = html.match(
    /(?:©|&copy;|Copyright)\s*(?:\d{4}[-–]\d{4}|\d{4})?\s*([^\n<|–\-]{2,60})/i
  );
  if (copyrightMatch) {
    const name = copyrightMatch[1].trim().replace(/\s+/g, " ");
    if (hasCorporationKeyword(name)) {
      return name;
    }
  }

  return null;
}

/** 法人名クロール用の追加パス */
const COMPANY_NAME_PATHS = [
  "/company",
  "/company/",
  "/about",
  "/about/",
  "/about-us",
  "/about-us/",
  "/company/about",
  "/company/about/",
];

/**
 * ルートドメインをクロールして法人名を取得する
 * 3回リトライ、取得できなければ null を返す
 */
export async function fetchCompanyName(url: string): Promise<string | null> {
  let domain: string;
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname;
  } catch {
    return null;
  }
  const rootUrl = `https://${domain}`;

  // 試みるURLリスト（ルート + 会社概要ページ候補）
  const candidates = [rootUrl, ...COMPANY_NAME_PATHS.map((p) => `${rootUrl}${p}`)];

  for (const candidate of candidates) {
    // 最大3回リトライ
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(candidate, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.5",
          },
          signal: controller.signal,
          redirect: "follow",
        });

        clearTimeout(timeoutId);

        if (!response.ok) break; // 4xx/5xx はリトライ不要

        const contentType = response.headers.get("content-type") || "";
        if (
          !contentType.includes("text/html") &&
          !contentType.includes("application/xhtml")
        ) {
          break;
        }

        const html = await response.text();
        const name = extractCompanyNameFromHtml(html);
        if (name) {
          return name;
        }

        break; // 取得できたが法人名なし → 次の候補へ
      } catch {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  return null;
}

export interface CompanyInfo {
  companyName?: string;       // 会社名
  industry?: string;          // 業種
  location?: string;          // 所在地
  employeeCount?: string;     // 従業員数
  capitalAmount?: string;     // 資本金
  phoneNumber?: string;       // 電話番号
  representativeName?: string; // 代表者名
  formUrl?: string;           // フォームURL
  hasForm: boolean;           // フォームあり/なし
}

/** ユーザーエージェント */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 会社概要ページの候補パス */
const COMPANY_PAGE_PATHS = [
  "/company",
  "/company/",
  "/about",
  "/about/",
  "/corporate",
  "/corporate/",
  "/kaisha",
  "/kaisha/",
  "/about-us",
  "/about-us/",
  "/company-profile",
  "/gaiyou",
];

/**
 * HTMLを取得する（10秒タイムアウト）
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
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return null;
    }

    const html = await response.text();
    // HTMLが長すぎる場合は先頭部分のみ使用
    return html.length > 500_000 ? html.substring(0, 500_000) : html;
  } catch {
    return null;
  }
}

/**
 * URLからドメインを抽出する
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * HTMLからscript/style/head等の不要タグを除去してテキストを圧縮する
 */
function compressHtml(html: string): string {
  // scriptタグ除去
  let compressed = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  // styleタグ除去
  compressed = compressed.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  // headタグ除去
  compressed = compressed.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  // HTMLコメント除去
  compressed = compressed.replace(/<!--[\s\S]*?-->/g, "");
  // タグを除去してテキストのみ抽出
  compressed = compressed.replace(/<[^>]+>/g, " ");
  // 連続空白・改行を圧縮
  compressed = compressed.replace(/\s+/g, " ").trim();
  // 長すぎる場合は切り詰め
  return compressed.length > 8000 ? compressed.substring(0, 8000) : compressed;
}

interface GeminiExtractedInfo {
  companyName: string | null;
  industry: string | null;
  location: string | null;
  employeeCount: string | null;
  capitalAmount: string | null;
  phoneNumber: string | null;
  representativeName: string | null;
}

/**
 * GeminiにHTMLテキストを渡して企業情報を抽出する
 */
async function extractInfoWithGemini(
  textContent: string
): Promise<GeminiExtractedInfo> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `以下のHTMLから企業情報を抽出してJSONで返してください。
見つからない項目はnullにしてください。

抽出項目: 会社名、業種、所在地（都道府県・市区町村）、従業員数、資本金、電話番号、代表者名

テキスト:
${textContent}

JSONのみ返してください：
{"companyName": "", "industry": "", "location": "", "employeeCount": "", "capitalAmount": "", "phoneNumber": "", "representativeName": ""}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        companyName: null,
        industry: null,
        location: null,
        employeeCount: null,
        capitalAmount: null,
        phoneNumber: null,
        representativeName: null,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiExtractedInfo;

    // 空文字列をnullに変換
    return {
      companyName: parsed.companyName || null,
      industry: parsed.industry || null,
      location: parsed.location || null,
      employeeCount: parsed.employeeCount || null,
      capitalAmount: parsed.capitalAmount || null,
      phoneNumber: parsed.phoneNumber || null,
      representativeName: parsed.representativeName || null,
    };
  } catch {
    return {
      companyName: null,
      industry: null,
      location: null,
      employeeCount: null,
      capitalAmount: null,
      phoneNumber: null,
      representativeName: null,
    };
  }
}

/**
 * 企業サイトにアクセスして企業情報を取得する
 */
export async function scrapeCompanyInfo(url: string): Promise<CompanyInfo> {
  const domain = extractDomain(url);
  const baseUrl = `https://${domain}`;

  try {
    // トップページのHTMLを取得
    let mainHtml = await fetchHtml(url);

    // 会社概要ページも試みる
    let companyPageHtml: string | null = null;
    for (const path of COMPANY_PAGE_PATHS) {
      const companyUrl = `${baseUrl}${path}`;
      const html = await fetchHtml(companyUrl);
      if (html) {
        companyPageHtml = html;
        break;
      }
    }

    // 情報抽出に使うHTMLを決定（会社概要ページ優先、なければトップページ）
    const htmlForExtraction = companyPageHtml || mainHtml;

    if (!htmlForExtraction) {
      return { hasForm: false };
    }

    // HTMLを圧縮してテキスト化
    const textContent = compressHtml(htmlForExtraction);

    // Geminiで企業情報を抽出
    const extracted = await extractInfoWithGemini(textContent);

    // フォーム検出（トップページHTMLを使用）
    const overviewHtml = mainHtml || htmlForExtraction;
    const formResult = await detectContactForm(domain, overviewHtml);

    const result: CompanyInfo = {
      hasForm: formResult.has_form,
    };

    if (extracted.companyName) result.companyName = extracted.companyName;
    if (extracted.industry) result.industry = extracted.industry;
    if (extracted.location) result.location = extracted.location;
    if (extracted.employeeCount) result.employeeCount = extracted.employeeCount;
    if (extracted.capitalAmount) result.capitalAmount = extracted.capitalAmount;
    if (extracted.phoneNumber) result.phoneNumber = extracted.phoneNumber;
    if (extracted.representativeName) result.representativeName = extracted.representativeName;
    if (formResult.form_url) result.formUrl = formResult.form_url;

    return result;
  } catch {
    // エラーは握りつぶし、部分的な情報を返す
    return { hasForm: false };
  }
}
