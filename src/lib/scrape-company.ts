// 企業情報クローリング
// 企業サイトにアクセスして会社情報を取得し、フォームの有無も判定する
// 3段階フォールバック: サイトマップ → タイトルフェッチ → パス推測

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
    const nestedSitemapRegex = /<sitemap>\s*<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
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
            const locRegex = /<url>\s*<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
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
      const locRegex = /<url>\s*<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/gi;
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
 * パスのパターンマッチで検索し、短いパスを優先する
 */
function findCompanyPageFromSitemap(urls: string[], _baseUrl: string): string | null {
  const companyPatterns = [
    /\/company\/?$/i,
    /\/about\/?$/i,
    /\/corporate\/?$/i,
    /\/kaisha\/?$/i,
    /\/about-us\/?$/i,
    /\/company-profile\/?$/i,
    /\/gaiyou\/?$/i,
    /\/outline\/?$/i,
    // URL-encoded Japanese
    /%E4%BC%9A%E7%A4%BE/i,     // 会社
    /%E6%A6%82%E8%A6%81/i,     // 概要
    /%E4%BC%81%E6%A5%AD/i,     // 企業
  ];

  const matches: { url: string; pathLength: number }[] = [];

  for (const u of urls) {
    try {
      const parsed = new URL(u);
      const path = parsed.pathname;
      for (const pattern of companyPatterns) {
        if (pattern.test(path)) {
          matches.push({ url: u, pathLength: path.split("/").filter(Boolean).length });
          break;
        }
      }
    } catch {
      // invalid URL, skip
    }
  }

  if (matches.length === 0) return null;

  // 短いパスを優先
  matches.sort((a, b) => a.pathLength - b.pathLength);
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

// ─── HTML解析 ───

interface StructuredContent {
  title: string;
  description: string;
  headings: string;
  bodyText: string;
}

/**
 * HTMLから構造化コンテンツを抽出する
 */
function extractStructuredContent(html: string): StructuredContent {
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

  // body text
  let bodyHtml = html;
  bodyHtml = bodyHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  bodyHtml = bodyHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  bodyHtml = bodyHtml.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  bodyHtml = bodyHtml.replace(/<!--[\s\S]*?-->/g, "");
  bodyHtml = bodyHtml.replace(/<[^>]+>/g, " ");
  bodyHtml = bodyHtml.replace(/\s+/g, " ").trim();
  const bodyText = bodyHtml.length > 5000 ? bodyHtml.substring(0, 5000) : bodyHtml;

  return { title, description, headings: headings.join("\n"), bodyText };
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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

  const structuredText = `【タイトル】${content.title}
【メタディスクリプション】${content.description}
【見出し】${content.headings}
【本文テキスト】${content.bodyText}`;

  const prompt = `このWebページが民間の法人・事業者の公式サイトかどうか判定し、企業情報を抽出してJSONで返してください。

判定基準:
- isCompanySite: true → 民間の法人・事業者の公式Webサイト（企業だけでなく、クリニック・医院・歯科医院・事務所・教室・サロン等の個人事業主の公式サイトも含む）（会社概要・製品・サービス等を掲載）
- isCompanySite: false → 以下のいずれかに該当する場合:
  - ポータルサイト・求人サイト・ニュースサイト・口コミサイト・まとめサイト・ディレクトリ・地図サービス・SNS等
  - 官公庁・自治体・公共機関のサイト（例: 市役所・区役所・町村役場・県庁・都庁・省庁・府省・国の機関・公立学校・公立病院・公立図書館・公共施設・独立行政法人・地方公共団体・公営企業など）。ドメインが .go.jp / .lg.jp / .ed.jp の場合も該当

isCompanySite: false の場合、他の項目は null で構いません。
isCompanySite: true の場合、以下の情報を抽出してください（見つからない項目はnullにしてください）:
- 会社名（法人格を必ず含める）
- 業種
- 所在地（都道府県・市区町村）
- 従業員数
- 資本金
- 電話番号
- 代表者名
- 設立年（西暦の数値のみ）
- 事業内容（30文字以内の簡潔な説明）
- industryMajor: 日本標準産業分類の大分類（例: 製造業, 情報通信業, 卸売業・小売業, 建設業, 医療・福祉, サービス業）
- industryMinor: 小分類（例: 化粧品製造業, ソフトウェア業, 一般診療所, 美容業）
- searchTags: 5-10個の検索用キーワード配列（事業内容から連想される実用的なタグ。例: ["化粧品","コスメ","スキンケア","D2C","通販"]）
- officers: 役員一覧（会社概要ページに記載されている場合のみ。最大10名。見つからなければ空配列[]）。形式: [{"name": "田中太郎", "title": "代表取締役"}]

【会社名の重要ルール】法人格（株式会社・有限会社・合同会社・一般社団法人・医療法人等）を必ず含めること。ページ内に法人格が記載されている場合は必ず付与する。英語名の場合も Co., Ltd. や Inc. 等を含めること。例: ×「山田商事」→ ○「株式会社山田商事」${industryCheckInstruction}

${structuredText}

JSONのみ返してください：
{"isCompanySite": true, "isRelevantIndustry": true, "companyName": "", "industry": "", "location": "", "employeeCount": "", "capitalAmount": "", "phoneNumber": "", "representativeName": "", "establishedYear": null, "businessDescription": "", "industryMajor": "", "industryMinor": "", "searchTags": [], "officers": []}`;

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

    // 構造化コンテンツを抽出
    const structuredContent = extractStructuredContent(htmlForExtraction);

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

    // 地域不一致チェック: Geminiが判定した所在地が依頼地域と明らかに異なる場合はスキップ
    // ただし所在地が不明（null）の場合はそのまま通す
    if (requestedLocation && extracted.location) {
      const loc = extracted.location;
      const req = requestedLocation;
      // 依頼地域のキーワードが所在地に含まれていなければ不一致とみなす
      // 都道府県レベル・市区町村レベルで判定
      const locationKeywords = req
        .replace(/[都道府県市区町村郡]/g, (m) => m + "|")
        .split("|")
        .map((s) => s.trim())
        .filter((s) => s.length >= 2);
      const hasLocationMatch =
        locationKeywords.length === 0 ||
        locationKeywords.some((keyword) => loc.includes(keyword)) ||
        loc.includes(req);
      if (!hasLocationMatch) {
        console.log(`  -> location mismatch: requested="${req}", found="${loc}", skipped`);
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

    // 最終結果を組み立て: Gemini + regex + フォーム検出
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
    if (extracted.industryMajor) result.industryMajor = extracted.industryMajor;
    if (extracted.industryMinor) result.industryMinor = extracted.industryMinor;
    if (extracted.searchTags) result.searchTags = extracted.searchTags;
    if (formResult.form_url) result.formUrl = formResult.form_url;

    // regex抽出データをマージ
    if (regexData.email) result.email = regexData.email;
    if (regexData.snsLinks) result.snsLinks = regexData.snsLinks;
    if (regexData.hasRecruitPage) result.hasRecruitPage = regexData.hasRecruitPage;
    if (regexData.siteUpdatedAt) result.siteUpdatedAt = regexData.siteUpdatedAt;

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
