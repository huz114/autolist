// 企業情報クローリング
// 企業サイトにアクセスして会社情報を取得し、フォームの有無も判定する

import { GoogleGenerativeAI } from "@google/generative-ai";
import { detectContactForm } from "./form-detector";
import { logGeminiUsage } from "@/lib/gemini-usage-logger";

export interface CompanyInfo {
  companyName?: string;          // 会社名
  industry?: string;             // 業種
  location?: string;             // 所在地
  employeeCount?: string;        // 従業員数
  capitalAmount?: string;        // 資本金
  phoneNumber?: string;          // 電話番号
  representativeName?: string;   // 代表者名
  establishedYear?: number;      // 設立年
  businessDescription?: string;  // 事業内容
  formUrl?: string;              // フォームURL
  hasForm: boolean;              // フォームあり/なし
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
  isCompanySite: boolean;
  isRelevantIndustry: boolean;
  companyName: string | null;
  industry: string | null;
  location: string | null;
  employeeCount: string | null;
  capitalAmount: string | null;
  phoneNumber: string | null;
  representativeName: string | null;
  establishedYear: number | null;
  businessDescription: string | null;
}

/**
 * GeminiにHTMLテキストを渡して企業情報を抽出する
 */
async function extractInfoWithGemini(
  textContent: string,
  requestedIndustry?: string
): Promise<GeminiExtractedInfo> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const industryCheckInstruction = requestedIndustry
    ? `\n\n【業種一致チェック】依頼された業種: 「${requestedIndustry}」\nこの企業が上記の業種に該当するかを判定してください。\n- isRelevantIndustry: true → 依頼業種に該当する（例: 「歯科クリニック」で歯科医院ならtrue）\n- isRelevantIndustry: false → 依頼業種に明らかに該当しない（例: 「歯科クリニック」で不用品回収業ならfalse）\n業種名が完全一致しなくても、事業内容が関連していればtrueにしてください。明らかに無関係な業種のみfalseにしてください。`
    : "";

  const prompt = `このWebページが民間の法人・事業者の公式サイトかどうか判定し、企業情報を抽出してJSONで返してください。

判定基準:
- isCompanySite: true → 民間の法人・事業者の公式Webサイト（企業だけでなく、クリニック・医院・歯科医院・事務所・教室・サロン等の個人事業主の公式サイトも含む）（会社概要・製品・サービス等を掲載）
- isCompanySite: false → 以下のいずれかに該当する場合:
  - ポータルサイト・求人サイト・ニュースサイト・口コミサイト・まとめサイト・ディレクトリ・地図サービス・SNS等
  - 官公庁・自治体・公共機関のサイト（例: 市役所・区役所・町村役場・県庁・都庁・省庁・府省・国の機関・公立学校・公立病院・公立図書館・公共施設・独立行政法人・地方公共団体・公営企業など）。ドメインが .go.jp / .lg.jp / .ed.jp の場合も該当

isCompanySite: false の場合、他の項目は null で構いません。
isCompanySite: true の場合、以下の情報を抽出してください（見つからない項目はnullにしてください）:
会社名、業種、所在地（都道府県・市区町村）、従業員数、資本金、電話番号、代表者名、設立年（西暦の数値のみ）、事業内容（30文字以内の簡潔な説明）

【会社名の重要ルール】法人格（株式会社・有限会社・合同会社・一般社団法人・医療法人等）を必ず含めること。ページ内に法人格が記載されている場合は必ず付与する。英語名の場合も Co., Ltd. や Inc. 等を含めること。例: ×「山田商事」→ ○「株式会社山田商事」${industryCheckInstruction}

テキスト:
${textContent}

JSONのみ返してください：
{"isCompanySite": true, "isRelevantIndustry": true, "companyName": "", "industry": "", "location": "", "employeeCount": "", "capitalAmount": "", "phoneNumber": "", "representativeName": "", "establishedYear": null, "businessDescription": ""}`;

  try {
    const result = await model.generateContent(prompt);
    await logGeminiUsage('scrapeCompany', result.response.usageMetadata);
    const responseText = result.response.text();

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        isCompanySite: false,
        isRelevantIndustry: true,
        companyName: null,
        industry: null,
        location: null,
        employeeCount: null,
        capitalAmount: null,
        phoneNumber: null,
        representativeName: null,
        establishedYear: null,
        businessDescription: null,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeminiExtractedInfo;

    // establishedYear を数値に正規化（文字列で返ってくる場合の対策）
    let establishedYear: number | null = null;
    if (parsed.establishedYear) {
      const year = typeof parsed.establishedYear === 'string'
        ? parseInt(parsed.establishedYear, 10)
        : parsed.establishedYear;
      if (!isNaN(year) && year >= 1800 && year <= new Date().getFullYear()) {
        establishedYear = year;
      }
    }

    return {
      isCompanySite: parsed.isCompanySite === true,
      isRelevantIndustry: parsed.isRelevantIndustry !== false, // 未指定時はtrue扱い
      companyName: parsed.companyName || null,
      industry: parsed.industry || null,
      location: parsed.location || null,
      employeeCount: parsed.employeeCount || null,
      capitalAmount: parsed.capitalAmount || null,
      phoneNumber: parsed.phoneNumber || null,
      representativeName: parsed.representativeName || null,
      establishedYear,
      businessDescription: parsed.businessDescription || null,
    };
  } catch {
    return {
      isCompanySite: false,
      isRelevantIndustry: true,
      companyName: null,
      industry: null,
      location: null,
      employeeCount: null,
      capitalAmount: null,
      phoneNumber: null,
      representativeName: null,
      establishedYear: null,
      businessDescription: null,
    };
  }
}

/**
 * 企業サイトにアクセスして企業情報を取得する
 */
export async function scrapeCompanyInfo(url: string, requestedIndustry?: string): Promise<CompanyInfo> {
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

    // Geminiで企業情報を抽出（依頼業種を渡して一致チェック）
    const extracted = await extractInfoWithGemini(textContent, requestedIndustry);

    // 企業公式サイトでない場合はhasForm: falseで早期リターン
    if (!extracted.isCompanySite) {
      return { hasForm: false };
    }

    // 業種不一致の場合はスキップ
    if (!extracted.isRelevantIndustry) {
      console.log(`  -> isRelevantIndustry: false, skipped (requested: ${requestedIndustry})`);
      return { hasForm: false };
    }

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
    if (extracted.establishedYear) result.establishedYear = extracted.establishedYear;
    if (extracted.businessDescription) result.businessDescription = extracted.businessDescription;
    if (formResult.form_url) result.formUrl = formResult.form_url;

    return result;
  } catch {
    // エラーは握りつぶし、部分的な情報を返す
    return { hasForm: false };
  }
}
