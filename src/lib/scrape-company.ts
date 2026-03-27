// 企業情報クローリング
// 企業サイトにアクセスして会社情報を取得し、フォームの有無も判定する
// 3段階フォールバック: サイトマップ → タイトルフェッチ → パス推測

import { GoogleGenerativeAI } from "@google/generative-ai";
import { detectContactForm } from "./form-detector";
import { logGeminiUsage } from "@/lib/gemini-usage-logger";
import { getIndustryMasterPromptText } from "./industry-master";

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
  email?: string;                // メールアドレス
  snsLinks?: {                   // SNSリンク
    x?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  hasRecruitPage?: boolean;      // 採用ページあり
  siteUpdatedAt?: string;        // サイト最終更新日
  searchTags?: string[];         // 検索タグ（5-10個）
  industryMajor?: string;        // 業種大分類
  industryMinor?: string;        // 業種小分類
  hasForm: boolean;
  formUrl?: string;
  officerPageUrl?: string;        // 役員ページURL
  officers?: { name: string; title: string }[];  // 役員一覧
  relatedSites?: string[];        // 関連サイト（サブドメイン）
  latestNews?: { date: string; title: string }[];  // 最新ニュース
}

// ─── 地域フィルタリング用ヘルパー ───

/** 都道府県・市区町村を構造的に抽出 */
function extractPrefectureAndCity(address: string): { prefecture: string | null; city: string | null } {
  let prefecture: string | null = null;
  let city: string | null = null;

  // 都道府県を抽出（北海道、東京都、大阪府、京都府、○○県）
  const prefMatch = address.match(/(北海道|東京都|大阪府|京都府|.{2,3}県)/);
  if (prefMatch) {
    prefecture = prefMatch[1];
  }

  // 市区町村を抽出（○○市、○○区、○○町、○○村、○○郡）
  // 都道府県の後ろから探す（都道府県がマッチした場合はその後ろ）
  const afterPref = prefMatch ? address.slice(address.indexOf(prefMatch[1]) + prefMatch[1].length) : address;
  // 政令指定都市の「○○市○○区」パターン: 市を取る
  const cityMatch = afterPref.match(/^(.{1,5}?[市郡])/) || afterPref.match(/^(.{1,5}?[区町村])/);
  if (cityMatch) {
    city = cityMatch[1];
  }

  return { prefecture, city };
}

/** 依頼地域と取得住所が一致するか判定 */
function isLocationMatch(requestedLocation: string, foundLocation: string): boolean {
  const req = extractPrefectureAndCity(requestedLocation);
  const found = extractPrefectureAndCity(foundLocation);

  // 依頼地域から都道府県すら抽出できない場合はフォールバック（文字列包含）
  if (!req.prefecture) {
    return foundLocation.includes(requestedLocation) || requestedLocation.includes(foundLocation);
  }

  // 都道府県が一致しない場合は不一致
  if (req.prefecture !== found.prefecture) {
    return false;
  }

  // 依頼地域に市区町村が指定されている場合は市区町村も一致を要求
  if (req.city) {
    if (!found.city) {
      // 取得住所から市区町村を抽出できない場合は通過させる（情報不足で除外しない）
      return true;
    }
    return req.city === found.city;
  }

  // 都道府県のみ指定の場合は都道府県一致でOK
  return true;
}

/** ユーザーエージェント */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 会社概要ページの候補パス */
const COMPANY_PAGE_PATHS = [
  "/company/profile",
  "/company/about",
  "/company/overview",
  "/corporate/profile",
  "/corporate/about",
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

/** アクセスページの候補パス */
const ACCESS_PAGE_PATHS = [
  "/company/access",
  "/access",
  "/office",
  "/location",
  "/map",
  "/company/office",
  "/corporate/access",
  "/company/map",
];

// ─── HTML取得 ───

/**
 * SSL証明書が有効かチェックする（HEADリクエスト、5秒タイムアウト）
 * 証明書エラー・httpへのリダイレクトを検出
 */
async function checkSslValid(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
      redirect: 'manual', // リダイレクトを自動フォローしない
    });
    // 3xx でhttpにリダイレクトされる場合はNG
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location && location.startsWith('http://')) {
        console.log(`  -> SSL redirect to HTTP detected: ${domain}`);
        return false;
      }
    }
    return true;
  } catch {
    // SSL証明書エラーなどでfetch自体が失敗
    console.log(`  -> SSL check failed for ${domain}`);
    return false;
  }
}

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

// ─── サイトマップ関連 ───

/**
 * サイトマップを取得してURL一覧を返す
 * ネストされたサイトマップは1階層まで（最大3つ）展開する
 * 最大500URLまで
 */
async function fetchSitemap(baseUrl: string): Promise<string[] | null> {
  try {
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    const response = await fetch(sitemapUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });

    if (!response.ok) return null;

    const xml = await response.text();
    if (!xml || xml.length < 50) return null;

    // ネストされたサイトマップをチェック
    const nestedSitemapRegex = /<sitemap>\s*<loc>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+)\s*(?:\]\]>)?\s*<\/loc>/gi;
    const nestedMatches: string[] = [];
    let nestedMatch;
    while ((nestedMatch = nestedSitemapRegex.exec(xml)) !== null) {
      nestedMatches.push(nestedMatch[1].trim());
    }

    const urls: string[] = [];

    if (nestedMatches.length > 0) {
      // サブサイトマップを最大3つ取得
      const subSitemaps = nestedMatches.slice(0, 3);
      for (const subUrl of subSitemaps) {
        if (urls.length >= 500) break;
        try {
          const subResponse = await fetch(subUrl, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(5000),
            redirect: "follow",
          });
          if (subResponse.ok) {
            const subXml = await subResponse.text();
            const locRegex = /<url>\s*<loc>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+)\s*(?:\]\]>)?\s*<\/loc>/gi;
            let locMatch;
            while ((locMatch = locRegex.exec(subXml)) !== null) {
              urls.push(locMatch[1].trim());
              if (urls.length >= 500) break;
            }
          }
        } catch {
          // サブサイトマップのフェッチ失敗は無視
        }
      }
    }

    // メインサイトマップからも直接URLを抽出
    if (urls.length < 500) {
      const locRegex = /<url>\s*<loc>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+)\s*(?:\]\]>)?\s*<\/loc>/gi;
      let locMatch;
      while ((locMatch = locRegex.exec(xml)) !== null) {
        const u = locMatch[1].trim();
        if (!urls.includes(u)) {
          urls.push(u);
          if (urls.length >= 500) break;
        }
      }
    }

    return urls.length > 0 ? urls : null;
  } catch {
    return null;
  }
}

/**
 * サイトマップURLリストから会社概要ページを見つける
 * パスのパターンマッチで検索し、より詳細なページ（深いパス）を優先する
 * /profile, /overview, /about などのサブパスにはボーナスを与える
 */
function findCompanyPageFromSitemap(urls: string[], _baseUrl: string): string | null {
  const companyPatterns = [
    /\/company\/(?:profile|about|overview)\/?$/i,
    /\/corporate\/(?:profile|about|overview)\/?$/i,
    /\/company-profile\/?$/i,
    /\/company\/?$/i,
    /\/about\/?$/i,
    /\/corporate\/?$/i,
    /\/kaisha\/?$/i,
    /\/about-us\/?$/i,
    /\/gaiyou\/?$/i,
    /\/outline\/?$/i,
    // URL-encoded Japanese
    /%E4%BC%9A%E7%A4%BE/i,     // 会社
    /%E6%A6%82%E8%A6%81/i,     // 概要
    /%E4%BC%81%E6%A5%AD/i,     // 企業
  ];

  // サブパスボーナス: /profile, /overview, /about を含むパスにボーナスを与える
  const detailSubPaths = /\/(profile|overview|about|gaiyou|outline)\/?$/i;

  const matches: { url: string; patternIndex: number; bonus: number }[] = [];

  for (const u of urls) {
    try {
      const parsed = new URL(u);
      const path = parsed.pathname;
      for (let i = 0; i < companyPatterns.length; i++) {
        if (companyPatterns[i].test(path)) {
          const bonus = detailSubPaths.test(path) ? -1 : 0; // -1 = higher priority in sort
          matches.push({ url: u, patternIndex: i, bonus });
          break;
        }
      }
    } catch {
      // invalid URL, skip
    }
  }

  if (matches.length === 0) return null;

  // パターンの優先度順にソートし、同一パターンならサブパスボーナスがある方を優先
  matches.sort((a, b) => {
    const indexDiff = a.patternIndex - b.patternIndex;
    if (indexDiff !== 0) return indexDiff;
    return a.bonus - b.bonus;
  });
  return matches[0].url;
}

/**
 * サイトマップURLからタイトルフェッチで会社概要ページを見つける
 * depth≤2のURLから候補を最大10件取得し、タイトルで判定
 */
async function findCompanyPageByTitleFetch(urls: string[], _baseUrl: string): Promise<string | null> {
  const excludePatterns = /\/(blog|news|products|recruit|ir|faq|privacy|contact|category|tag|archive|feed|wp-content|wp-admin|wp-json|assets|images|css|js)\b/i;

  // depth≤2 のURLを抽出
  const candidates: string[] = [];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length <= 2 && !excludePatterns.test(parsed.pathname)) {
        candidates.push(u);
      }
    } catch {
      // skip
    }
    if (candidates.length >= 10) break;
  }

  const titlePatterns = /会社概要|企業情報|会社情報|企業概要|About|Company|Corporate/i;

  // 並列でタイトルフェッチ（全候補を同時にリクエスト）
  const results = await Promise.allSettled(
    candidates.map(async (candidateUrl) => {
      const response = await fetch(candidateUrl, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
      });

      if (!response.ok) return null;

      // 先頭10KBだけ読む
      const reader = response.body?.getReader();
      if (!reader) return null;

      let html = "";
      const decoder = new TextDecoder();
      let bytesRead = 0;
      const maxBytes = 10240;

      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytesRead += value.length;
      }
      reader.cancel().catch(() => {});

      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch && titlePatterns.test(titleMatch[1])) {
        return candidateUrl;
      }
      return null;
    })
  );

  // 最初にマッチしたURLを返す（候補の順序を維持）
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      return result.value;
    }
  }

  return null;
}

interface LinkInfo {
  url: string;
  text: string;
}

/**
 * HTMLからリンクを抽出し、同一ドメインのURLのみ返す（擬似サイトマップ）
 */
function extractLinksFromHtml(html: string, domain: string): LinkInfo[] {
  // Extract <a href="...">text</a> patterns
  const aTagRegex = /<a\s[^>]*href=["'](https?:\/\/[^"'<>\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const links: LinkInfo[] = [];
  let match;

  while ((match = aTagRegex.exec(html)) !== null) {
    const rawUrl = match[1].split('#')[0].split('?')[0];
    const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!rawUrl || seen.has(rawUrl)) continue;

    try {
      const urlObj = new URL(rawUrl);
      const urlDomain = urlObj.hostname.replace(/^www\./, '');
      if (urlDomain === domain && urlObj.pathname !== '/') {
        seen.add(rawUrl);
        links.push({ url: rawUrl, text });
      }
    } catch {
      // skip
    }
  }

  // Also extract relative links
  const relATagRegex = /<a\s[^>]*href=["'](\/[^"'<>\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = relATagRegex.exec(html)) !== null) {
    const path = match[1].split('#')[0].split('?')[0];
    const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!path || path === '/') continue;
    const fullUrl = `https://${domain}${path}`;
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      links.push({ url: fullUrl, text });
    }
  }

  return links;
}

/**
 * リンクテキストから役員ページURLを検出する
 */
function findOfficerPageUrl(links: LinkInfo[]): string | null {
  const textPatterns = /役員|取締役|経営陣|マネジメント|management|officer|director|executive|board.?of/i;
  const urlPatterns = /\/officer|\/yakuin|\/directors|\/board|\/management|\/executive/i;

  // First try: text match
  for (const link of links) {
    if (textPatterns.test(link.text)) {
      return link.url;
    }
  }

  // Second try: URL pattern match
  for (const link of links) {
    if (urlPatterns.test(link.url)) {
      return link.url;
    }
  }

  return null;
}

/**
 * HTMLからサブドメインの関連サイトを抽出する
 */
function extractRelatedSites(html: string, domain: string): string[] {
  const hrefRegex = /href=["'](https?:\/\/[^"'<>\s]+)["']/gi;
  const seen = new Set<string>();
  const sites: string[] = [];
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const urlObj = new URL(match[1]);
      const hostname = urlObj.hostname.replace(/^www\./, '');
      // Same base domain but different subdomain
      if (hostname !== domain && hostname.endsWith('.' + domain)) {
        if (!seen.has(hostname)) {
          seen.add(hostname);
          sites.push(hostname);
        }
      }
      // Also detect common second-level domain matches
      // e.g., openhouse-group.co.jp links to openhouse.co.jp
      const baseParts = domain.split('.');
      const hostParts = hostname.split('.');
      if (baseParts.length >= 2 && hostParts.length >= 2) {
        const baseSld = baseParts[baseParts.length - 2]; // second-level domain
        const hostSld = hostParts[hostParts.length - 2];
        // If SLDs share a common root and aren't generic TLDs
        if (baseSld !== hostSld && hostname !== domain &&
            !['co', 'or', 'ne', 'ac', 'go', 'com', 'net', 'org'].includes(hostSld) &&
            (baseSld.includes(hostSld) || hostSld.includes(baseSld)) &&
            !seen.has(hostname)) {
          seen.add(hostname);
          sites.push(hostname);
        }
      }
    } catch {
      // skip
    }
  }

  // Limit to 10 related sites
  return sites.slice(0, 10);
}

/**
 * HTMLから外部ドメインの企業情報ページリンクを検出する
 * 大手企業のサービスサイト→コーポレートサイトのパターンに対応
 */
function findExternalCorporateLink(html: string, currentDomain: string): string | null {
  const aTagRegex = /<a\s[^>]*href=["'](https?:\/\/[^"'<>\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const corporateTextPatterns = /^(?:会社情報|会社概要|企業情報|企業概要|運営会社|コーポレート|Corporate|About\s*Us|Company)$/i;

  let match;
  while ((match = aTagRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    if (!corporateTextPatterns.test(text)) continue;

    try {
      const urlObj = new URL(href);
      const linkDomain = urlObj.hostname.replace(/^www\./, '');
      // Only follow if it's a DIFFERENT domain (external corporate site)
      if (linkDomain !== currentDomain) {
        console.log(`  -> External corporate link found: "${text}" -> ${href}`);
        return href;
      }
    } catch {
      // skip
    }
  }

  return null;
}

interface NewsItem {
  date: string;
  title: string;
}

/**
 * トップページHTMLから最新ニュース/お知らせを抽出する（最新5件）
 */
function extractNewsFromHtml(html: string): NewsItem[] {
  const news: NewsItem[] = [];

  // Find date+text pairs in common news list structures
  // Look for patterns like: date ... title within list items, table rows, etc.
  const newsBlockRegex = /(?:<(?:li|tr|div|dl)[^>]*>\s*(?:<[^>]*>)*\s*)(\d{4}[-\/.\s年]\d{1,2}[-\/.\s月]\d{1,2}日?)\s*(?:<[^>]*>)*\s*(?:<a[^>]*>)?\s*([^<]{5,100})/gi;

  let match;
  const seen = new Set<string>();

  while ((match = newsBlockRegex.exec(html)) !== null && news.length < 5) {
    const dateStr = match[1].replace(/[年月]/g, '-').replace(/日/g, '').replace(/\./g, '-').replace(/\//g, '-').trim();
    const title = match[2].replace(/\s+/g, ' ').trim();

    // Validate it's a reasonable date
    const dateParts = dateStr.split('-').map(Number);
    if (dateParts[0] >= 2020 && dateParts[0] <= 2030 && title.length >= 5) {
      const key = `${dateStr}:${title}`;
      if (!seen.has(key)) {
        seen.add(key);
        news.push({ date: dateStr, title });
      }
    }
  }

  return news;
}

/**
 * 役員ページHTMLから役員情報を抽出する（正規表現のみ、Geminiなし）
 */
function extractOfficersFromHtml(html: string): { representativeName?: string; officers: { name: string; title: string }[] } {
  const officers: { name: string; title: string }[] = [];
  let representativeName: string | undefined;

  // Common patterns for officer listings in Japanese company pages
  // Pattern: 代表取締役（社長）　田中太郎 or 代表取締役社長 田中 太郎
  const titlePatterns = [
    /(?:代表取締役(?:社長|会長)?|代表(?:社員|執行役員)?)\s*[：:\s]\s*([^\s<\n]{2,10}(?:\s[^\s<\n]{1,8})?)/g,
    /<(?:td|dd|span|div|p)[^>]*>\s*(?:代表取締役(?:社長|会長)?|代表(?:社員|執行役員)?)\s*<\/(?:td|dd|span|div|p)>\s*<(?:td|dd|span|div|p)[^>]*>\s*([^<]{2,20})\s*</gi,
  ];

  // Try to find representative name
  for (const pattern of titlePatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const name = match[1].replace(/\s+/g, ' ').trim();
      // Filter out obvious non-names (too short, contains HTML, numbers)
      if (name.length >= 2 && name.length <= 20 && !/[<>0-9]/.test(name) && !/氏$|様$/.test(name)) {
        if (!representativeName) {
          representativeName = name;
        }
        officers.push({ name, title: '代表取締役' });
        break;
      }
    }
    if (representativeName) break;
  }

  // Also try to extract other officers with common titles
  const officerRegex = /(取締役|常務|専務|監査役|執行役員|相談役)\s*[：:\s]\s*([^\s<\n]{2,10}(?:\s[^\s<\n]{1,8})?)/g;
  let officerMatch;
  while ((officerMatch = officerRegex.exec(html)) !== null && officers.length < 10) {
    const title = officerMatch[1].trim();
    const name = officerMatch[2].replace(/\s+/g, ' ').trim();
    if (name.length >= 2 && name.length <= 20 && !/[<>0-9]/.test(name)) {
      // Avoid duplicates
      if (!officers.some(o => o.name === name)) {
        officers.push({ name, title });
      }
    }
  }

  return { representativeName, officers };
}

// ─── JSON-LD抽出 ───

interface JsonLdData {
  name?: string;
  address?: string;
  telephone?: string;
  email?: string;
  founder?: string;
  description?: string;
  foundingDate?: string;
  url?: string;
  sameAs?: string[];
  employeeCount?: string;
}

/**
 * HTMLから JSON-LD (schema.org) の企業情報を抽出する
 * <script type="application/ld+json"> タグから Organization, LocalBusiness, Corporation 等を探す
 */
function extractJsonLd(html: string): JsonLdData | null {
  const scriptRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const targetTypes = ['Organization', 'LocalBusiness', 'Corporation', 'MedicalBusiness',
    'LegalService', 'FinancialService', 'RealEstateAgent', 'Store', 'Restaurant',
    'AutoDealer', 'HomeAndConstructionBusiness', 'ProfessionalService'];

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const raw = match[1].trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      // Handle @graph arrays
      const candidates = Array.isArray(parsed) ? parsed :
        parsed['@graph'] ? (Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed['@graph']]) :
        [parsed];

      for (const obj of candidates) {
        const type = obj['@type'];
        const typeStr = Array.isArray(type) ? type.join(',') : (type || '');
        const isTarget = targetTypes.some(t => typeStr.includes(t));
        if (!isTarget) continue;

        const result: JsonLdData = {};

        // name
        if (obj.name) result.name = typeof obj.name === 'string' ? obj.name : String(obj.name);

        // address
        if (obj.address) {
          if (typeof obj.address === 'string') {
            result.address = obj.address;
          } else if (typeof obj.address === 'object') {
            const a = obj.address;
            const parts = [a.postalCode, a.addressRegion, a.addressLocality, a.streetAddress].filter(Boolean);
            if (parts.length > 0) {
              result.address = parts.join(' ');
            }
          }
        }
        if (!result.address && obj.location) {
          if (typeof obj.location === 'string') {
            result.address = obj.location;
          } else if (typeof obj.location === 'object' && obj.location.address) {
            const a = obj.location.address;
            if (typeof a === 'string') {
              result.address = a;
            } else {
              const parts = [a.postalCode, a.addressRegion, a.addressLocality, a.streetAddress].filter(Boolean);
              if (parts.length > 0) result.address = parts.join(' ');
            }
          }
        }

        // telephone
        if (obj.telephone) result.telephone = String(obj.telephone);

        // email
        if (obj.email) result.email = String(obj.email);

        // founder
        if (obj.founder) {
          if (typeof obj.founder === 'string') result.founder = obj.founder;
          else if (obj.founder.name) result.founder = String(obj.founder.name);
        }

        // description
        if (obj.description) result.description = typeof obj.description === 'string'
          ? obj.description.substring(0, 300) : String(obj.description).substring(0, 300);

        // foundingDate
        if (obj.foundingDate) result.foundingDate = String(obj.foundingDate);

        // url
        if (obj.url) result.url = String(obj.url);

        // sameAs (SNS links etc.)
        if (obj.sameAs) {
          result.sameAs = Array.isArray(obj.sameAs) ? obj.sameAs.map(String) : [String(obj.sameAs)];
        }

        // numberOfEmployees
        if (obj.numberOfEmployees) {
          if (typeof obj.numberOfEmployees === 'object' && obj.numberOfEmployees.value) {
            result.employeeCount = String(obj.numberOfEmployees.value);
          } else if (typeof obj.numberOfEmployees === 'string' || typeof obj.numberOfEmployees === 'number') {
            result.employeeCount = String(obj.numberOfEmployees);
          }
        }

        // At least name or address must be present
        if (result.name || result.address) {
          return result;
        }
      }
    } catch {
      // JSON parse error, skip this script tag
    }
  }

  return null;
}

// ─── キーワードベーススマート抽出 ───

/** フラグメント抽出のキーワード定義（設計書準拠）
 * contextBefore/contextAfter で切り出し範囲を制御
 */
interface KeywordGroupDef {
  keywords: string[];
  contextBefore: number;
  contextAfter: number;
  maxTotalChars?: number; // グループ全体の上限
}

const KEYWORD_GROUP_DEFS: Record<string, KeywordGroupDef> = {
  company_name: {
    keywords: ['株式会社', '有限会社', '合同会社', '一般社団法人', '医療法人', '社会福祉法人'],
    contextBefore: 30,
    contextAfter: 30,
  },
  representative: {
    keywords: ['代表取締役', '代表者', 'CEO', '社長', '代表者名', '代表 '],
    contextBefore: 0,
    contextAfter: 50,
  },
  address: {
    keywords: ['所在地', '住所', '本社', '〒', '本店所在地', 'アクセス',
      '北海道', '東京都', '大阪府', '京都府', '愛知県', '福岡県', '神奈川県', '埼玉県', '千葉県', '兵庫県'],
    contextBefore: 0,
    contextAfter: 100,
  },
  business: {
    keywords: ['事業内容', '事業概要', '主な事業', 'サービス内容', '業務内容'],
    contextBefore: 0,
    contextAfter: 200,
  },
  officers: {
    keywords: ['取締役', '監査役', '執行役員'],
    contextBefore: 0,
    contextAfter: 30,
    maxTotalChars: 500,
  },
  capital: {
    keywords: ['資本金', '資本'],
    contextBefore: 0,
    contextAfter: 50,
  },
  founded: {
    keywords: ['設立', '創業', '設立年月', '創立'],
    contextBefore: 0,
    contextAfter: 50,
  },
  employees: {
    keywords: ['従業員数', '社員数', '従業員', 'スタッフ数'],
    contextBefore: 0,
    contextAfter: 50,
  },
  phone: {
    keywords: ['TEL', '電話', 'tel:', 'phone', '03-', '06-', '0120-'],
    contextBefore: 0,
    contextAfter: 30,
  },
  email: {
    keywords: ['mail', 'info@', 'contact@', 'メール', 'E-mail'],
    contextBefore: 0,
    contextAfter: 50,
  },
  sns: {
    keywords: ['twitter.com', 'x.com', 'instagram.com', 'facebook.com', 'youtube.com'],
    contextBefore: 0,
    contextAfter: 80,
  },
  hiring: {
    keywords: ['採用情報', '採用', 'recruit', 'career', '求人'],
    contextBefore: 0,
    contextAfter: 30,
  },
  industry: {
    keywords: ['業種', '業態', '取扱商品', '主要取引先'],
    contextBefore: 0,
    contextAfter: 50,
  },
};

// 後方互換: extractByKeywords内で使う簡易マップ
const KEYWORD_GROUPS: Record<string, string[]> = Object.fromEntries(
  Object.entries(KEYWORD_GROUP_DEFS).map(([k, v]) => [k, v.keywords])
);

interface KeywordExtract {
  group: string;
  text: string;
}

/**
 * HTMLからキーワード周辺のテキストを抽出する
 * 設計書準拠: グループごとに異なる切り出し範囲 (contextBefore/contextAfter) を使用
 * ナビ/フッター除去済みHTMLを推奨
 */
function extractByKeywords(html: string): KeywordExtract[] {
  // HTMLからプレーンテキストを生成（ナビ/フッター除去済み）
  let plainText = stripNavigationElements(html);
  plainText = plainText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  plainText = plainText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  plainText = plainText.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  plainText = plainText.replace(/<!--[\s\S]*?-->/g, '');
  plainText = plainText.replace(/<[^>]+>/g, ' ');
  plainText = plainText.replace(/\s+/g, ' ').trim();

  const results: KeywordExtract[] = [];

  for (const [group, def] of Object.entries(KEYWORD_GROUP_DEFS)) {
    const { keywords, contextBefore, contextAfter, maxTotalChars } = def;
    const ranges: { start: number; end: number }[] = [];
    let totalChars = 0;

    for (const keyword of keywords) {
      const lowerText = plainText.toLowerCase();
      const lowerKeyword = keyword.toLowerCase();
      let searchFrom = 0;

      while (searchFrom < lowerText.length) {
        const idx = lowerText.indexOf(lowerKeyword, searchFrom);
        if (idx === -1) break;

        const start = Math.max(0, idx - contextBefore);
        const end = Math.min(plainText.length, idx + keyword.length + contextAfter);

        // Check if this range overlaps with existing ranges
        let merged = false;
        for (let i = 0; i < ranges.length; i++) {
          if (start <= ranges[i].end && end >= ranges[i].start) {
            ranges[i].start = Math.min(ranges[i].start, start);
            ranges[i].end = Math.max(ranges[i].end, end);
            merged = true;
            break;
          }
        }
        if (!merged) {
          ranges.push({ start, end });
        }

        searchFrom = idx + keyword.length;
        if (ranges.length >= 5) break;
      }

      if (ranges.length >= 5) break;
    }

    // Extract text for each range, respecting maxTotalChars
    for (const range of ranges) {
      const text = plainText.substring(range.start, range.end).trim();
      if (text.length > 10) {
        if (maxTotalChars && totalChars + text.length > maxTotalChars) {
          const remaining = maxTotalChars - totalChars;
          if (remaining > 20) {
            results.push({ group, text: text.substring(0, remaining) });
            totalChars += remaining;
          }
          break;
        }
        results.push({ group, text });
        totalChars += text.length;
      }
    }
  }

  return results;
}

// ─── スマートコンテンツ統合 ───

/**
 * JSON-LD + キーワード抽出 + 従来のbodyTextを統合して5000文字以内のスマートコンテンツを生成
 */
function buildSmartContent(
  jsonLdData: JsonLdData | null,
  keywordExtracts: KeywordExtract[],
  title: string,
  description: string,
  headings: string,
  fallbackBodyText: string
): string {
  const MAX_LENGTH = 5000;
  const parts: string[] = [];
  let currentLength = 0;

  // Priority 1: JSON-LD structured data
  if (jsonLdData) {
    const ldLines: string[] = ['【構造化データ】'];
    if (jsonLdData.name) ldLines.push(`企業名: ${jsonLdData.name}`);
    if (jsonLdData.address) ldLines.push(`住所: ${jsonLdData.address}`);
    if (jsonLdData.telephone) ldLines.push(`電話: ${jsonLdData.telephone}`);
    if (jsonLdData.email) ldLines.push(`メール: ${jsonLdData.email}`);
    if (jsonLdData.founder) ldLines.push(`代表者: ${jsonLdData.founder}`);
    if (jsonLdData.foundingDate) ldLines.push(`設立: ${jsonLdData.foundingDate}`);
    if (jsonLdData.employeeCount) ldLines.push(`従業員数: ${jsonLdData.employeeCount}`);
    if (jsonLdData.description) ldLines.push(`概要: ${jsonLdData.description}`);
    if (jsonLdData.sameAs && jsonLdData.sameAs.length > 0) {
      ldLines.push(`SNS: ${jsonLdData.sameAs.join(', ')}`);
    }

    const ldText = ldLines.join('\n');
    if (currentLength + ldText.length <= MAX_LENGTH) {
      parts.push(ldText);
      currentLength += ldText.length;
    }
  }

  // Priority 2: Keyword-based extractions
  const groupLabels: Record<string, string> = {
    address: '住所周辺',
    representative: '代表者周辺',
    capital: '資本金周辺',
    founded: '設立年周辺',
    employees: '従業員数周辺',
    phone: '電話番号周辺',
    email: 'メール周辺',
    business: '事業内容周辺',
    sns: 'SNS周辺',
    hiring: '採用情報周辺',
    industry: '業種周辺',
  };

  // Group extracts by group name
  const grouped = new Map<string, string[]>();
  for (const extract of keywordExtracts) {
    if (!grouped.has(extract.group)) {
      grouped.set(extract.group, []);
    }
    grouped.get(extract.group)!.push(extract.text);
  }

  const groupKeys = Array.from(grouped.keys());
  for (const group of groupKeys) {
    const texts = grouped.get(group)!;
    const label = groupLabels[group] || group;
    const sectionText = `【${label}】${texts.join(' ... ')}`;
    if (currentLength + sectionText.length + 1 <= MAX_LENGTH) {
      parts.push(sectionText);
      currentLength += sectionText.length + 1;
    } else {
      // Truncate to fit remaining space
      const remaining = MAX_LENGTH - currentLength - 1;
      if (remaining > 50) {
        parts.push(sectionText.substring(0, remaining));
        currentLength = MAX_LENGTH;
      }
      break;
    }
  }

  // Priority 3: Traditional content (title, description, headings, body text)
  if (currentLength < MAX_LENGTH) {
    const traditional: string[] = [];
    if (title) traditional.push(`【タイトル】${title}`);
    if (description) traditional.push(`【メタディスクリプション】${description}`);
    if (headings) traditional.push(`【見出し】${headings}`);

    for (const t of traditional) {
      if (currentLength + t.length + 1 <= MAX_LENGTH) {
        parts.push(t);
        currentLength += t.length + 1;
      }
    }

    // Fill remaining with body text
    const remaining = MAX_LENGTH - currentLength;
    if (remaining > 100 && fallbackBodyText) {
      const bodyPart = `【本文テキスト】${fallbackBodyText.substring(0, remaining - 10)}`;
      parts.push(bodyPart);
    }
  }

  return parts.join('\n');
}

// ─── HTML解析 ───

interface StructuredContent {
  title: string;
  description: string;
  headings: string;
  bodyText: string;
  /** JSON-LDから抽出した構造化データ */
  jsonLdData: JsonLdData | null;
  /** キーワードベース抽出結果 */
  keywordExtracts: KeywordExtract[];
  /** スマート統合テキスト（5000文字以内） */
  smartContent: string;
  /** パターンマッチ確定データ */
  confirmedData: ConfirmedData;
  /** ナビ/フッター除去済みプレーンテキスト */
  cleanBodyText: string;
}

/**
 * HTMLから構造化コンテンツを抽出する
 * JSON-LD → キーワードベース抽出 → 従来のテキスト抽出の3層で情報を収集
 */
function extractStructuredContent(html: string): StructuredContent {
  // Step 1: JSON-LD抽出（scriptタグ除去前に実行）
  const jsonLdData = extractJsonLd(html);

  // title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

  // meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["'][^>]*>/i);
  const description = descMatch ? descMatch[1].replace(/\s+/g, " ").trim() : "";

  // h1-h3
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  const headings: string[] = [];
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const text = hMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length > 0 && text.length < 200) {
      headings.push(text);
    }
  }

  // Step 2: キーワードベース抽出
  const keywordExtracts = extractByKeywords(html);

  // body text (従来方式: フォールバック用)
  let bodyHtml = html;
  bodyHtml = bodyHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  bodyHtml = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  bodyHtml = bodyHtml.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  bodyHtml = bodyHtml.replace(/<!--[\s\S]*?-->/g, "");
  bodyHtml = bodyHtml.replace(/<[^>]+>/g, " ");
  bodyHtml = bodyHtml.replace(/\s+/g, " ").trim();
  const bodyText = bodyHtml.length > 5000 ? bodyHtml.substring(0, 5000) : bodyHtml;

  // Step 2.5: ナビ/フッター除去済みプレーンテキスト
  let cleanHtml = stripNavigationElements(html);
  cleanHtml = cleanHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleanHtml = cleanHtml.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  cleanHtml = cleanHtml.replace(/<!--[\s\S]*?-->/g, "");
  cleanHtml = cleanHtml.replace(/<[^>]+>/g, " ");
  cleanHtml = cleanHtml.replace(/\s+/g, " ").trim();
  const cleanBodyText = cleanHtml.length > 8000 ? cleanHtml.substring(0, 8000) : cleanHtml;

  // Step 3: パターンマッチ確定（confirmed）
  const confirmedData = extractConfirmed(cleanBodyText);

  // Step 4: スマートコンテンツ統合
  const headingsStr = headings.join("\n");
  const smartContent = buildSmartContent(
    jsonLdData,
    keywordExtracts,
    title,
    description,
    headingsStr,
    bodyText
  );

  return { title, description, headings: headingsStr, bodyText, jsonLdData, keywordExtracts, smartContent, confirmedData, cleanBodyText };
}

// ─── パターンマッチ確定（confirmed） ───

interface ConfirmedData {
  foundingYear: number | null;
  capitalManYen: number | null;
  capitalRaw: string | null;
  phone: string | null;
  employeeCount: number | null;
  employeeCountRaw: string | null;
  email: string | null;
}

/** 和暦→西暦変換 */
function warekiToSeireki(era: string, year: number): number {
  const bases: Record<string, number> = {
    '明治': 1867,
    '大正': 1911,
    '昭和': 1925,
    '平成': 1988,
    '令和': 2018,
  };
  return (bases[era] || 0) + year;
}

/**
 * テキストから正規表現で確実に取れる項目を確定抽出する
 * Geminiに投げずに済む項目を事前に確定してコスト・精度を改善
 */
function extractConfirmed(text: string): ConfirmedData {
  const result: ConfirmedData = {
    foundingYear: null,
    capitalManYen: null,
    capitalRaw: null,
    phone: null,
    employeeCount: null,
    employeeCountRaw: null,
    email: null,
  };

  // --- 設立年 ---
  // 和暦パターン: (設立|創業|創立)...（明治|大正|昭和|平成|令和）XX年
  const foundingWareki = text.match(/(設立|創業|創立)[\s:：]*?(明治|大正|昭和|平成|令和)(\d{1,2})\s*年/);
  if (foundingWareki) {
    const era = foundingWareki[2];
    const yearNum = parseInt(foundingWareki[3], 10);
    const seireki = warekiToSeireki(era, yearNum);
    if (seireki >= 1868 && seireki <= new Date().getFullYear()) {
      result.foundingYear = seireki;
    }
  }
  // 西暦パターン: (設立|創業|創立)...XXXX年
  if (!result.foundingYear) {
    const foundingSeireki = text.match(/(設立|創業|創立)[\s:：]*?(\d{4})\s*年/);
    if (foundingSeireki) {
      const year = parseInt(foundingSeireki[2], 10);
      if (year >= 1800 && year <= new Date().getFullYear()) {
        result.foundingYear = year;
      }
    }
  }

  // --- 資本金 ---
  const capitalMatch = text.match(/資本金[\s:：]*?([\d,]+)\s*(万円|百万円|億円|円)/);
  if (capitalMatch) {
    const numStr = capitalMatch[1].replace(/,/g, '');
    const num = parseInt(numStr, 10);
    const unit = capitalMatch[2];
    result.capitalRaw = `${capitalMatch[1]}${unit}`;
    if (unit === '万円') {
      result.capitalManYen = num;
    } else if (unit === '百万円') {
      result.capitalManYen = num * 100;
    } else if (unit === '億円') {
      result.capitalManYen = num * 10000;
    } else if (unit === '円') {
      result.capitalManYen = Math.round(num / 10000);
    }
  }

  // --- 電話番号 ---
  const phoneMatch = text.match(/(TEL|電話|tel|Tel|phone|Phone|PHONE)[\s:：]*?(0\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4})/);
  if (phoneMatch) {
    result.phone = phoneMatch[2].replace(/\s/g, '').trim();
  }
  // TELラベルなしでも電話番号パターン（03-XXXX-XXXX等）を拾う
  if (!result.phone) {
    const barePhone = text.match(/(?:^|[\s　])(\d{2,4}-\d{2,4}-\d{3,4})(?:[\s　]|$)/);
    if (barePhone) {
      result.phone = barePhone[1];
    }
  }

  // --- 従業員数 ---
  const empMatch = text.match(/(従業員|社員)[\s数:：]*?([\d,]+)\s*(名|人)/);
  if (empMatch) {
    result.employeeCountRaw = `${empMatch[2]}${empMatch[3]}`;
    result.employeeCount = parseInt(empMatch[2].replace(/,/g, ''), 10);
  }

  // --- メールアドレス ---
  const emailRegex = /[\w][\w.+\-]*@[\w][\w.\-]*\.\w{2,}/g;
  const excludeEmail = /noreply|no-reply|no_reply|example\.com|sample\.|test\.|dummy\.|wixpress|sentry/i;
  let emailMatch;
  while ((emailMatch = emailRegex.exec(text)) !== null) {
    if (!excludeEmail.test(emailMatch[0])) {
      result.email = emailMatch[0];
      break;
    }
  }

  return result;
}

// ─── ナビ/フッター共通テキスト除去 ───

/**
 * HTMLからナビ・ヘッダー・フッター・サイドバー・パンくずリストを除去する
 * 都度スクレイピングで1-2ページしかない場合の簡易版
 */
function stripNavigationElements(html: string): string {
  let cleaned = html;
  // <nav>, <header>, <footer>, <aside> タグ内を除去
  cleaned = cleaned.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ');
  cleaned = cleaned.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ');
  cleaned = cleaned.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ');
  cleaned = cleaned.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, ' ');
  // パンくずリスト（breadcrumb クラス・id・aria-label）
  cleaned = cleaned.replace(/<(?:nav|ol|ul|div)\b[^>]*(?:class|id)=["'][^"']*breadcrumb[^"']*["'][^>]*>[\s\S]*?<\/(?:nav|ol|ul|div)>/gi, ' ');
  cleaned = cleaned.replace(/<(?:nav|ol|ul|div)\b[^>]*aria-label=["'][^"']*breadcrumb[^"']*["'][^>]*>[\s\S]*?<\/(?:nav|ol|ul|div)>/gi, ' ');
  return cleaned;
}

// ─── regex抽出 ───

interface RegexExtracted {
  email?: string;
  snsLinks?: {
    x?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  hasRecruitPage: boolean;
  siteUpdatedAt?: string;
}

/**
 * HTMLからregexパターンで情報を抽出する
 */
function extractFromHtmlRegex(html: string): RegexExtracted {
  const result: RegexExtracted = { hasRecruitPage: false };

  // --- Email ---
  const mailtoMatch = html.match(/mailto:([^\s"'<>]+)/i);
  const emailPatternRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const excludeEmailPatterns = /@example\.|@sample\.|@xxx\.|@mail\.com|@email\.com|@test\.|@dummy\.|@placeholder\.|\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.webp$/i;

  if (mailtoMatch) {
    const email = mailtoMatch[1].split("?")[0]; // remove ?subject= etc
    if (!excludeEmailPatterns.test(email)) {
      result.email = email;
    }
  }
  if (!result.email) {
    let emailMatch;
    while ((emailMatch = emailPatternRegex.exec(html)) !== null) {
      if (!excludeEmailPatterns.test(emailMatch[0])) {
        result.email = emailMatch[0];
        break;
      }
    }
  }

  // --- SNS links ---
  const sns: { x?: string; instagram?: string; facebook?: string; youtube?: string } = {};
  const hrefRegex = /href=["'](https?:\/\/[^"'<>\s]+)["']/gi;
  let hrefMatch;
  while ((hrefMatch = hrefRegex.exec(html)) !== null) {
    const href = hrefMatch[1];
    if (!sns.x && /(twitter\.com|x\.com)\/[a-zA-Z0-9_]/i.test(href)) {
      sns.x = href;
    }
    if (!sns.instagram && /instagram\.com\/[a-zA-Z0-9_.]/i.test(href)) {
      sns.instagram = href;
    }
    if (!sns.facebook && /facebook\.com\/[a-zA-Z0-9_.]/i.test(href)) {
      sns.facebook = href;
    }
    if (!sns.youtube && /(youtube\.com|youtu\.be)\/[a-zA-Z0-9_@]/i.test(href)) {
      sns.youtube = href;
    }
  }
  if (sns.x || sns.instagram || sns.facebook || sns.youtube) {
    result.snsLinks = sns;
  }

  // --- Recruit page ---
  const recruitRegex = /<a[^>]*href=["'][^"']*\/(recruit|career|careers|saiyo|hiring|jobs|employment)\b[^"']*["'][^>]*>/i;
  result.hasRecruitPage = recruitRegex.test(html);

  // --- Site updated at ---
  // First try <time> tag
  const timeTagRegex = /<time[^>]*datetime=["']([^"']+)["'][^>]*>/gi;
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  let latestDate: Date | null = null;
  let latestDateStr: string | null = null;

  let timeMatch;
  while ((timeMatch = timeTagRegex.exec(html)) !== null) {
    const d = new Date(timeMatch[1]);
    if (!isNaN(d.getTime()) && d >= twoYearsAgo && d <= now) {
      if (!latestDate || d > latestDate) {
        latestDate = d;
        latestDateStr = timeMatch[1];
      }
    }
  }

  // Also look for date patterns in text
  const datePatterns = [
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
  ];
  for (const pattern of datePatterns) {
    let dateMatch;
    while ((dateMatch = pattern.exec(html)) !== null) {
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1;
      const day = parseInt(dateMatch[3]);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime()) && d >= twoYearsAgo && d <= now) {
        if (!latestDate || d > latestDate) {
          latestDate = d;
          latestDateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }
    }
  }

  if (latestDateStr) {
    result.siteUpdatedAt = latestDateStr;
  }

  return result;
}

/**
 * 2つのRegexExtracted結果をマージする
 * 会社概要ページの値を優先（siteUpdatedAtは最新を採用）
 */
function mergeRegexExtracted(main: RegexExtracted, company: RegexExtracted): RegexExtracted {
  const merged: RegexExtracted = {
    email: company.email || main.email,
    hasRecruitPage: company.hasRecruitPage || main.hasRecruitPage,
  };

  // SNS: merge both, prefer company page
  const mainSns = main.snsLinks || {};
  const companySns = company.snsLinks || {};
  const mergedSns = {
    x: companySns.x || mainSns.x,
    instagram: companySns.instagram || mainSns.instagram,
    facebook: companySns.facebook || mainSns.facebook,
    youtube: companySns.youtube || mainSns.youtube,
  };
  if (mergedSns.x || mergedSns.instagram || mergedSns.facebook || mergedSns.youtube) {
    merged.snsLinks = mergedSns;
  }

  // siteUpdatedAt: take the most recent
  if (main.siteUpdatedAt && company.siteUpdatedAt) {
    const mainDate = new Date(main.siteUpdatedAt);
    const companyDate = new Date(company.siteUpdatedAt);
    merged.siteUpdatedAt = companyDate >= mainDate ? company.siteUpdatedAt : main.siteUpdatedAt;
  } else {
    merged.siteUpdatedAt = company.siteUpdatedAt || main.siteUpdatedAt;
  }

  return merged;
}

// ─── Gemini抽出 ───

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
  industryMajor: string | null;
  industryMinor: string | null;
  searchTags: string[] | null;
  officers: { name: string; title: string }[] | null;
}

/**
 * GeminiにHTMLテキストを渡して企業情報を抽出する
 */
async function extractInfoWithGemini(
  content: StructuredContent,
  requestedIndustry?: string
): Promise<GeminiExtractedInfo> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const industryCheckInstruction = requestedIndustry
    ? `\n\n【業種一致チェック】依頼された業種: 「${requestedIndustry}」
この企業が依頼された業種の事業を「自社で直接行っている」場合のみ isRelevantIndustry: true にしてください。

以下のような「関連サービス業」は、依頼業種とは異なるため isRelevantIndustry: false にしてください：
- 支援・コンサルティング会社（○○業向けコンサル等）
- 人材紹介・派遣会社（○○業界専門の人材サービス等）
- IT・システム開発会社（○○業向けシステム・SaaS等）
- 機器・材料・資材のメーカーや卸売（○○業向け機器販売等）
- 比較サイト・ポータルサイト運営
- フランチャイズ本部（加盟店ではなく本部の場合）
- 業界団体・協会
- 研修・教育・セミナー事業者

例：
- 依頼「病院」→ 病院・クリニック・医院 = true、医療機器メーカー・医療IT・医療人材・臨床検査業・医療機関開業支援 = false
- 依頼「美容室」→ 美容室・ヘアサロン = true、美容ディーラー・美容求人サイト・美容機器メーカー = false
- 依頼「通販事業者」→ 自社ECで商品販売 = true、ECカート提供・通販代行・EC支援 = false
- 依頼「飲食店」→ レストラン・居酒屋・カフェ = true、食品卸・飲食店向けシステム・飲食コンサル = false`
    : "";

  // confirmed項目はGeminiに渡さない（正規表現で確定済み）
  // fragments + JSON-LDデータのみ渡す
  const confirmed = content.confirmedData;

  // フラグメントテキストを構築（キーワード抽出結果をグループごとにまとめる）
  const fragmentGroups = new Map<string, string[]>();
  for (const extract of content.keywordExtracts) {
    if (!fragmentGroups.has(extract.group)) {
      fragmentGroups.set(extract.group, []);
    }
    fragmentGroups.get(extract.group)!.push(extract.text);
  }

  const fragmentLines: string[] = [];
  const fragmentLabels: Record<string, string> = {
    company_name: '企業名周辺', representative: '代表者周辺', address: '住所周辺',
    business: '事業内容周辺', officers: '役員周辺', capital: '資本金周辺',
    founded: '設立年周辺', employees: '従業員数周辺', phone: '電話番号周辺',
    email: 'メール周辺', sns: 'SNS周辺', hiring: '採用情報周辺', industry: '業種周辺',
  };
  for (const [group, texts] of Array.from(fragmentGroups.entries())) {
    const label = fragmentLabels[group] || group;
    fragmentLines.push(`【${label}】${texts.join(' ... ')}`);
  }

  // JSON-LDテキスト
  const jsonLdLines: string[] = [];
  if (content.jsonLdData) {
    const ld = content.jsonLdData;
    jsonLdLines.push('【構造化データ（JSON-LD）】');
    if (ld.name) jsonLdLines.push(`企業名: ${ld.name}`);
    if (ld.address) jsonLdLines.push(`住所: ${ld.address}`);
    if (ld.telephone) jsonLdLines.push(`電話: ${ld.telephone}`);
    if (ld.email) jsonLdLines.push(`メール: ${ld.email}`);
    if (ld.founder) jsonLdLines.push(`代表者: ${ld.founder}`);
    if (ld.foundingDate) jsonLdLines.push(`設立: ${ld.foundingDate}`);
    if (ld.employeeCount) jsonLdLines.push(`従業員数: ${ld.employeeCount}`);
    if (ld.description) jsonLdLines.push(`概要: ${ld.description}`);
    if (ld.sameAs && ld.sameAs.length > 0) jsonLdLines.push(`SNS: ${ld.sameAs.join(', ')}`);
  }

  // タイトル・メタディスクリプション
  const metaLines: string[] = [];
  if (content.title) metaLines.push(`【タイトル】${content.title}`);
  if (content.description) metaLines.push(`【メタディスクリプション】${content.description}`);
  if (content.headings) metaLines.push(`【見出し】${content.headings}`);

  // confirmed済み項目をGeminiに通知（重複抽出を避ける）
  const confirmedNotice: string[] = [];
  if (confirmed.foundingYear) confirmedNotice.push(`設立年: ${confirmed.foundingYear}（確定済み・抽出不要）`);
  if (confirmed.capitalRaw) confirmedNotice.push(`資本金: ${confirmed.capitalRaw}（確定済み・抽出不要）`);
  if (confirmed.phone) confirmedNotice.push(`電話番号: ${confirmed.phone}（確定済み・抽出不要）`);
  if (confirmed.employeeCountRaw) confirmedNotice.push(`従業員数: ${confirmed.employeeCountRaw}（確定済み・抽出不要）`);
  if (confirmed.email) confirmedNotice.push(`メール: ${confirmed.email}（確定済み・抽出不要）`);

  const confirmedSection = confirmedNotice.length > 0
    ? `\n【事前確定済み項目（抽出不要）】\n${confirmedNotice.join('\n')}\n`
    : '';

  // 入力テキスト構築（5000文字制限）
  const allInputParts = [
    ...jsonLdLines,
    confirmedSection,
    ...fragmentLines,
    ...metaLines,
  ].filter(Boolean);

  let inputText = allInputParts.join('\n');
  if (inputText.length > 5000) {
    inputText = inputText.substring(0, 5000);
  }

  // JSON-LDデータがある場合の追加指示
  const jsonLdInstruction = content.jsonLdData
    ? `\n\n【構造化データについて】ページにはJSON-LD（schema.org）の構造化データが含まれています。構造化データの情報は信頼度が高いため、他のテキストと矛盾する場合は構造化データを優先してください。`
    : '';

  // 業種マスター
  const industryMasterText = getIndustryMasterPromptText();

  const prompt = `このWebページが民間の法人・事業者の公式サイトかどうか判定し、企業情報を抽出してJSONで返してください。

判定基準:
- isCompanySite: true → 民間の法人・事業者の公式Webサイト（企業だけでなく、クリニック・医院・歯科医院・事務所・教室・サロン等の個人事業主の公式サイトも含む）（会社概要・製品・サービス等を掲載）
- isCompanySite: false → 以下のいずれかに該当する場合:
  - ポータルサイト・求人サイト・ニュースサイト・口コミサイト・まとめサイト・ディレクトリ・地図サービス・SNS等
  - 官公庁・自治体・公共機関のサイト（例: 市役所・区役所・町村役場・県庁・都庁・省庁・府省・国の機関・公立学校・公立病院・公立図書館・公共施設・独立行政法人・地方公共団体・公営企業など）。ドメインが .go.jp / .lg.jp / .ed.jp の場合も該当

isCompanySite: false の場合、他の項目は null で構いません。
isCompanySite: true の場合、以下の7項目を抽出してください（見つからない項目はnullにしてください）:
1. companyName: 会社名（法人格を必ず含める）
2. representativeName: 代表者名の整形
3. location: 所在地（番地・ビル名まで含むフル住所。例: 東京都港区六本木1-2-3 ABCビル5F）
4. businessDescription: 事業内容（50文字以内の簡潔な要約）
5. industryMajor / industryMinor: 業種マスターから選択
6. searchTags: 5-10個の検索用キーワード配列（事業内容から連想される実用的なタグ）
7. officers: 役員一覧（最大10名。見つからなければ空配列[]）。形式: [{"name": "田中太郎", "title": "代表取締役"}]

※ 設立年・資本金・電話番号・従業員数・メールは事前確定済みのため抽出不要です（nullで返してください）

【業種マスター（20大分類・小分類）】
${industryMasterText}

【会社名の重要ルール】法人格（株式会社・有限会社・合同会社・一般社団法人・医療法人等）を必ず含めること。ページ内に法人格が記載されている場合は必ず付与する。英語名の場合も Co., Ltd. や Inc. 等を含めること。例: ×「山田商事」→ ○「株式会社山田商事」${industryCheckInstruction}${jsonLdInstruction}

${inputText}

JSONのみ返してください：
{"isCompanySite": true, "isRelevantIndustry": true, "companyName": "", "location": "", "representativeName": "", "businessDescription": "", "industryMajor": "", "industryMinor": "", "searchTags": [], "officers": []}`;

  try {
    const result = await model.generateContent(prompt);
    await logGeminiUsage('scrapeCompany', result.response.usageMetadata);
    const responseText = result.response.text();

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return defaultGeminiResult();
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
      isRelevantIndustry: parsed.isRelevantIndustry !== false,
      companyName: parsed.companyName || null,
      industry: parsed.industry || null,
      location: parsed.location || null,
      employeeCount: parsed.employeeCount || null,
      capitalAmount: parsed.capitalAmount || null,
      phoneNumber: parsed.phoneNumber || null,
      representativeName: parsed.representativeName || null,
      establishedYear,
      businessDescription: parsed.businessDescription || null,
      industryMajor: parsed.industryMajor || null,
      industryMinor: parsed.industryMinor || null,
      searchTags: Array.isArray(parsed.searchTags) && parsed.searchTags.length > 0
        ? parsed.searchTags
        : null,
      officers: Array.isArray(parsed.officers) && parsed.officers.length > 0
        ? parsed.officers.slice(0, 10)
        : null,
    };
  } catch {
    return defaultGeminiResult();
  }
}

function defaultGeminiResult(): GeminiExtractedInfo {
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
    industryMajor: null,
    industryMinor: null,
    searchTags: null,
    officers: null,
  };
}

// ─── メイン関数 ───

/**
 * 企業サイトにアクセスして企業情報を取得する
 * 3段階フォールバック: サイトマップ → タイトルフェッチ → パス推測
 */
export async function scrapeCompanyInfo(url: string, requestedIndustry?: string, requestedLocation?: string): Promise<CompanyInfo> {
  const domain = extractDomain(url);
  const baseUrl = `https://${domain}`;

  try {
    // SSL証明書チェック（無効なサイトはスキップ）
    const sslValid = await checkSslValid(domain);
    if (!sslValid) {
      console.log(`  -> Skipped ${domain}: invalid SSL certificate`);
      return { hasForm: false };
    }

    // トップページのHTMLを取得
    const mainHtml = await fetchHtml(url);

    // 会社概要ページを3段階フォールバックで探す
    let companyPageHtml: string | null = null;
    let companyPageSource = "homepage-only";

    // Step 1: サイトマップから探す
    const sitemapUrls = await fetchSitemap(baseUrl);
    if (sitemapUrls) {
      const companyPageUrl = findCompanyPageFromSitemap(sitemapUrls, baseUrl);
      if (companyPageUrl) {
        companyPageHtml = await fetchHtml(companyPageUrl);
        if (companyPageHtml) {
          companyPageSource = "sitemap";
          console.log(`  -> Company page found via sitemap: ${companyPageUrl}`);
        }
      }

      // Step 2: サイトマップはあるが会社概要URLが見つからない場合、タイトルフェッチ
      if (!companyPageHtml) {
        const titlePageUrl = await findCompanyPageByTitleFetch(sitemapUrls, baseUrl);
        if (titlePageUrl) {
          companyPageHtml = await fetchHtml(titlePageUrl);
          if (companyPageHtml) {
            companyPageSource = "title-fetch";
            console.log(`  -> Company page found via title fetch: ${titlePageUrl}`);
          }
        }
      }
    }

    // Step 2.5: トップページのリンクから擬似サイトマップを作成
    if (!companyPageHtml && mainHtml) {
      const pageLinks = extractLinksFromHtml(mainHtml, domain);
      if (pageLinks.length > 0) {
        const pageUrls = pageLinks.map(l => l.url);

        // まずURLパターンマッチ
        const companyPageUrl = findCompanyPageFromSitemap(pageUrls, baseUrl);
        if (companyPageUrl) {
          companyPageHtml = await fetchHtml(companyPageUrl);
          if (companyPageHtml) {
            companyPageSource = "homepage-links";
            console.log(`  -> Company page found via homepage links: ${companyPageUrl}`);
          }
        }

        // パターンマッチで見つからなければタイトルフェッチ
        if (!companyPageHtml) {
          const titlePageUrl = await findCompanyPageByTitleFetch(pageUrls, baseUrl);
          if (titlePageUrl) {
            companyPageHtml = await fetchHtml(titlePageUrl);
            if (companyPageHtml) {
              companyPageSource = "homepage-links-title";
              console.log(`  -> Company page found via homepage links title fetch: ${titlePageUrl}`);
            }
          }
        }
      }
    }

    // Step 2.75: 外部コーポレートサイトリンクをフォロー（サービスサイト→企業サイトパターン）
    if (!companyPageHtml && mainHtml) {
      const externalCorporateUrl = findExternalCorporateLink(mainHtml, domain);
      if (externalCorporateUrl) {
        companyPageHtml = await fetchHtml(externalCorporateUrl);
        if (companyPageHtml) {
          companyPageSource = "external-corporate";
          console.log(`  -> Company page found via external corporate link: ${externalCorporateUrl}`);
        }
      }
    }

    // Step 3: パス推測フォールバック
    if (!companyPageHtml) {
      for (const path of COMPANY_PAGE_PATHS) {
        const companyUrl = `${baseUrl}${path}`;
        const html = await fetchHtml(companyUrl);
        if (html) {
          companyPageHtml = html;
          companyPageSource = "path-guess";
          console.log(`  -> Company page found via path guess: ${companyUrl}`);
          break;
        }
      }
    }

    if (!companyPageHtml && !mainHtml) {
      console.log(`  -> Company page discovery: ${companyPageSource}`);
      return { hasForm: false };
    }

    if (companyPageSource === "homepage-only") {
      console.log(`  -> Company page discovery: homepage-only (no company page found)`);
    }

    // 情報抽出に使うHTMLを決定（会社概要ページ優先、なければトップページ）
    const htmlForExtraction = companyPageHtml || mainHtml;
    if (!htmlForExtraction) {
      return { hasForm: false };
    }

    // アクセスページ探索（住所が別ページにある場合の対策）
    let accessPageHtml: string | null = null;
    if (companyPageHtml) {
      // サイトマップURLからアクセスページをパターンマッチ
      const accessPatterns = [
        /\/(?:company\/)?access\/?$/i,
        /\/office\/?$/i,
        /\/location\/?$/i,
        /\/map\/?$/i,
        /\/corporate\/access\/?$/i,
        /\/company\/(?:office|map)\/?$/i,
      ];
      const allUrlSources = sitemapUrls || [];
      // トップページリンクも追加
      if (mainHtml) {
        const pageLinks = extractLinksFromHtml(mainHtml, domain);
        for (const link of pageLinks) {
          if (!allUrlSources.includes(link.url)) {
            allUrlSources.push(link.url);
          }
        }
      }
      // 会社概要ページリンクも追加
      const companyLinks = extractLinksFromHtml(companyPageHtml, domain);
      for (const link of companyLinks) {
        if (!allUrlSources.includes(link.url)) {
          allUrlSources.push(link.url);
        }
      }

      for (const u of allUrlSources) {
        try {
          const parsed = new URL(u);
          const path = parsed.pathname;
          if (accessPatterns.some(p => p.test(path))) {
            accessPageHtml = await fetchHtml(u);
            if (accessPageHtml) {
              console.log(`  -> Access page found: ${u}`);
              break;
            }
          }
        } catch { /* skip */ }
      }

      // パス推測フォールバック
      if (!accessPageHtml) {
        for (const path of ACCESS_PAGE_PATHS) {
          const accessUrl = `${baseUrl}${path}`;
          accessPageHtml = await fetchHtml(accessUrl);
          if (accessPageHtml) {
            console.log(`  -> Access page found via path guess: ${accessUrl}`);
            break;
          }
        }
      }
    }

    // 会社概要ページとアクセスページのHTMLを結合して抽出に使用
    const combinedHtml = accessPageHtml
      ? htmlForExtraction + '\n<!-- ACCESS PAGE -->\n' + accessPageHtml
      : htmlForExtraction;

    // 構造化コンテンツを抽出（結合HTMLから）
    const structuredContent = extractStructuredContent(combinedHtml);

    // regex抽出（メインページと会社概要ページの両方から）
    const mainRegex = mainHtml ? extractFromHtmlRegex(mainHtml) : { hasRecruitPage: false } as RegexExtracted;
    const companyRegex = companyPageHtml ? extractFromHtmlRegex(companyPageHtml) : { hasRecruitPage: false } as RegexExtracted;
    const regexData = companyPageHtml && mainHtml
      ? mergeRegexExtracted(mainRegex, companyRegex)
      : (companyPageHtml ? companyRegex : mainRegex);

    // 役員ページURL検出（トップページ + 会社概要ページのリンクから）
    const allLinks = [
      ...(mainHtml ? extractLinksFromHtml(mainHtml, domain) : []),
      ...(companyPageHtml ? extractLinksFromHtml(companyPageHtml, domain) : []),
    ];
    const officerPageUrl = findOfficerPageUrl(allLinks);

    // 関連サイト抽出
    let relatedSites = mainHtml ? extractRelatedSites(mainHtml, domain) : [];

    // 外部コーポレートサイト経由の場合、企業サイトからの関連サイトも追加
    if (companyPageSource === "external-corporate" && companyPageHtml) {
      const corpRelated = extractRelatedSites(companyPageHtml, domain);
      for (const site of corpRelated) {
        if (!relatedSites.includes(site)) {
          relatedSites.push(site);
        }
      }
    }

    // 最新ニュース抽出
    const latestNews = mainHtml ? extractNewsFromHtml(mainHtml) : [];

    // Geminiで企業情報を抽出（依頼業種を渡して一致チェック）
    const extracted = await extractInfoWithGemini(structuredContent, requestedIndustry);

    // 役員ページがある場合、代表者名が未取得 or 役員リストが空ならフェッチして抽出
    if (officerPageUrl && (!extracted.representativeName || !extracted.officers || extracted.officers.length === 0)) {
      const officerHtml = await fetchHtml(officerPageUrl);
      if (officerHtml) {
        const officerData = extractOfficersFromHtml(officerHtml);
        if (!extracted.representativeName && officerData.representativeName) {
          extracted.representativeName = officerData.representativeName;
          console.log(`  -> Representative name extracted from officer page: ${officerData.representativeName}`);
        }
        if ((!extracted.officers || extracted.officers.length === 0) && officerData.officers.length > 0) {
          extracted.officers = officerData.officers;
          console.log(`  -> ${officerData.officers.length} officers extracted from officer page`);
        }
      }
    }

    // 企業公式サイトでない場合はhasForm: falseで早期リターン
    if (!extracted.isCompanySite) {
      return { hasForm: false };
    }

    // 業種不一致の場合はスキップ
    if (!extracted.isRelevantIndustry) {
      console.log(`  -> isRelevantIndustry: false, skipped (requested: ${requestedIndustry})`);
      return { hasForm: false };
    }

    // 地域不一致チェック: 依頼地域と取得住所を都道府県・市区町村レベルで構造的に比較
    // 所在地が不明（null/空）の場合はそのまま通す（住所なしで除外すると有効な企業も失う）
    if (requestedLocation && extracted.location) {
      if (!isLocationMatch(requestedLocation, extracted.location)) {
        console.log(`  -> location mismatch: requested="${requestedLocation}", found="${extracted.location}", skipped`);
        return { hasForm: false };
      }
    }

    // フォーム検出（トップページHTMLを使用）— 15秒タイムアウト
    const overviewHtml = mainHtml || htmlForExtraction;
    let formResult: { has_form: boolean; form_url?: string | null } = { has_form: false };
    try {
      formResult = await Promise.race([
        detectContactForm(domain, overviewHtml),
        new Promise<{ has_form: boolean; form_url?: string | null }>((_, reject) =>
          setTimeout(() => reject(new Error('Form detection timeout')), 15000)
        ),
      ]);
    } catch {
      console.log(`  -> Form detection timed out for ${domain}`);
    }

    // 最終結果を組み立て: confirmed > Gemini > JSON-LD の優先順位で統合
    const confirmed = structuredContent.confirmedData;
    const jsonLd = structuredContent.jsonLdData;
    const result: CompanyInfo = {
      hasForm: formResult.has_form,
    };

    // 会社名: Gemini > JSON-LD（confirmedには該当項目なし）
    if (extracted.companyName) {
      result.companyName = extracted.companyName;
    } else if (jsonLd?.name) {
      result.companyName = jsonLd.name;
    }

    // 業種: Gemini only
    if (extracted.industry) result.industry = extracted.industry;

    // 所在地: Gemini > JSON-LD（confirmedには該当項目なし）
    if (extracted.location) {
      result.location = extracted.location;
    } else if (jsonLd?.address) {
      result.location = jsonLd.address;
    }

    // 従業員数: confirmed > Gemini > JSON-LD
    if (confirmed.employeeCount != null) {
      result.employeeCount = String(confirmed.employeeCount);
    } else if (extracted.employeeCount) {
      result.employeeCount = extracted.employeeCount;
    } else if (jsonLd?.employeeCount) {
      result.employeeCount = jsonLd.employeeCount;
    }

    // 資本金: confirmed > Gemini
    if (confirmed.capitalRaw) {
      result.capitalAmount = confirmed.capitalRaw;
    } else if (extracted.capitalAmount) {
      result.capitalAmount = extracted.capitalAmount;
    }

    // 電話番号: confirmed > Gemini > JSON-LD
    if (confirmed.phone) {
      result.phoneNumber = confirmed.phone;
    } else if (extracted.phoneNumber) {
      result.phoneNumber = extracted.phoneNumber;
    } else if (jsonLd?.telephone) {
      result.phoneNumber = jsonLd.telephone;
    }

    // 代表者名: Gemini > JSON-LD（confirmedには該当項目なし）
    if (extracted.representativeName) {
      result.representativeName = extracted.representativeName;
    } else if (jsonLd?.founder) {
      result.representativeName = jsonLd.founder;
    }

    // 設立年: confirmed > Gemini > JSON-LD
    if (confirmed.foundingYear) {
      result.establishedYear = confirmed.foundingYear;
    } else if (extracted.establishedYear) {
      result.establishedYear = extracted.establishedYear;
    } else if (jsonLd?.foundingDate) {
      const year = parseInt(jsonLd.foundingDate, 10);
      if (!isNaN(year) && year >= 1800 && year <= new Date().getFullYear()) {
        result.establishedYear = year;
      }
    }

    // 事業内容: Gemini > JSON-LD
    if (extracted.businessDescription) {
      result.businessDescription = extracted.businessDescription;
    } else if (jsonLd?.description) {
      result.businessDescription = jsonLd.description.substring(0, 50);
    }

    // 業種マスター: Gemini only
    if (extracted.industryMajor) result.industryMajor = extracted.industryMajor;
    if (extracted.industryMinor) result.industryMinor = extracted.industryMinor;
    if (extracted.searchTags) result.searchTags = extracted.searchTags;
    if (formResult.form_url) result.formUrl = formResult.form_url;

    // メール: confirmed > regex > JSON-LD
    if (confirmed.email) {
      result.email = confirmed.email;
    } else if (regexData.email) {
      result.email = regexData.email;
    } else if (jsonLd?.email) {
      result.email = jsonLd.email;
    }

    // regex抽出データをマージ（email以外）
    if (regexData.snsLinks) result.snsLinks = regexData.snsLinks;
    if (regexData.hasRecruitPage) result.hasRecruitPage = regexData.hasRecruitPage;
    if (regexData.siteUpdatedAt) result.siteUpdatedAt = regexData.siteUpdatedAt;

    // SNS: JSON-LD sameAs からも補完
    if (jsonLd?.sameAs && jsonLd.sameAs.length > 0) {
      const sns = result.snsLinks || {};
      for (const link of jsonLd.sameAs) {
        if (!sns.x && /(twitter\.com|x\.com)\/[a-zA-Z0-9_]/i.test(link)) sns.x = link;
        if (!sns.instagram && /instagram\.com\/[a-zA-Z0-9_.]/i.test(link)) sns.instagram = link;
        if (!sns.facebook && /facebook\.com\/[a-zA-Z0-9_.]/i.test(link)) sns.facebook = link;
        if (!sns.youtube && /(youtube\.com|youtu\.be)\/[a-zA-Z0-9_@]/i.test(link)) sns.youtube = link;
      }
      if (sns.x || sns.instagram || sns.facebook || sns.youtube) {
        result.snsLinks = sns;
      }
    }

    // 新規抽出データをマージ
    if (officerPageUrl) result.officerPageUrl = officerPageUrl;
    if (extracted.officers && extracted.officers.length > 0) result.officers = extracted.officers;
    if (relatedSites.length > 0) result.relatedSites = relatedSites;
    if (latestNews.length > 0) result.latestNews = latestNews;

    return result;
  } catch {
    // エラーは握りつぶし、部分的な情報を返す
    return { hasForm: false };
  }
}
