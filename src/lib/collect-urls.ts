import { prisma } from './prisma';
import { scrapeCompanyInfo } from './scrape-company';

// ─── ドメインブラックリスト（修正1） ───────────────────────────────────────
// ディレクトリ・ポータル・SNS・政府機関など、個社サイトではないドメインを除外する
const DOMAIN_BLACKLIST: ReadonlySet<string> = new Set([
  // 地図・グルメ・求人ポータル
  'mapion.co.jp',
  'biz.ne.jp',
  'tabelog.com',
  'hotpepper.jp',
  'townwork.net',
  // 就職・転職
  'indeed.com',
  'mynavi.jp',
  'rikunabi.com',
  'recruit.co.jp',
  'doda.jp',
  'bizreach.jp',
  'en-japan.com',
  'wantedly.com',
  'linkedin.com',
  // SNS
  'facebook.com',
  'twitter.com',
  'instagram.com',
  'youtube.com',
  // 百科事典・大手EC・検索
  'wikipedia.org',
  'amazon.co.jp',
  'rakuten.co.jp',
  'yahoo.co.jp',
  'google.com',
  'apple.com',
  'microsoft.com',
  // レビュー・口コミ
  'yelp.com',
  'foursquare.com',
  'tripadvisor.jp',
  // 政府機関
  'nta.go.jp',
  'mlit.go.jp',
  'meti.go.jp',
  'pref.tokyo.lg.jp',
  'city.tokyo.lg.jp',
  // タウンページ・電話帳・生活情報
  'itp.ne.jp',
  'townpage.net',
  'ekiten.jp',
  'lifemedia.jp',
  // ナビ・検索
  'navitime.co.jp',
  'goo.ne.jp',
  'bing.com',
  // ニュース・通信社
  'nikkei.com',
  'kyodo.co.jp',
  // 営業リスト・まとめ記事系
  'salesnow.jp',
  'syukatsu-kaigi.jp',
  'system-kanji.com',
  'system-dev-navi.com',
  'readycrew.jp',
  'stock-sun.com',
  'itkonwakai.jp',
  'genee.jp',
  'gicp.co.jp',
  // 医療ポータル・口コミ
  'epark.jp',
  'caloo.jp',
  'denternet.jp',
  'scuel.me',
  'hospita.jp',
  'doctorsfile.jp',
  'byoinnavi.jp',
  'haisha-yoyaku.jp',
  'fdoc.jp',
  'medinew.jp',
  // スパム・低品質
  'papapa.net',
]);

// ─── パスブラックリスト（修正3） ────────────────────────────────────────────
// 記事・ブログ系（他サイトがその会社を紹介しているページ）や
// ディレクトリ・検索系（まとめサイト・比較サイトのリストページ）を除外する
const PATH_BLACKLIST: ReadonlyArray<string> = [
  // 記事・ブログ系
  '/blog/',
  '/article/',
  '/articles/',
  '/news/',
  '/column/',
  '/columns/',
  '/media/',
  '/magazine/',
  '/topics/',
  '/post/',
  '/posts/',
  '/knowledge/',
  '/info/',
  '/case/',
  '/cases/',
  '/report/',
  '/reports/',
  // ディレクトリ・検索系
  '/search/',
  '/list/',
  '/lists/',
  '/find/',
  '/ranking/',
  '/rankings/',
  '/directory/',
  '/catalog/',
  '/compare/',
  '/companylist/',
  '/industry_s/',
  '/phonebook/',
  '/kaishalchiran/',
];

/**
 * URLのパスがブラックリストに該当するか確認する
 */
function isBlockedPath(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    for (const blocked of PATH_BLACKLIST) {
      if (path.includes(blocked)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── 除外TLDリスト（修正2） ────────────────────────────────────────────────
// 協同組合・官公庁・学校など、営業先として不適切なTLDを除外する
const EXCLUDED_TLD_PATTERNS: ReadonlyArray<RegExp> = [
  /\.or\.jp$/,   // 協同組合・業界団体
  /\.go\.jp$/,   // 官公庁
  /\.ac\.jp$/,   // 大学・学校
  /\.ed\.jp$/,   // 教育機関
];

/**
 * ドメインがブラックリストまたは除外TLDに該当するか確認する
 */
function isBlockedDomain(domain: string): boolean {
  // ブラックリストチェック（www.なしの正規化済みドメインで照合）
  if (DOMAIN_BLACKLIST.has(domain)) return true;

  // サブドメインを持つ場合もベースドメインで照合（例: jobs.tabelog.com → tabelog.com）
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (DOMAIN_BLACKLIST.has(parent)) return true;
  }

  // TLDパターンチェック
  for (const pattern of EXCLUDED_TLD_PATTERNS) {
    if (pattern.test(domain)) return true;
  }

  return false;
}
// ──────────────────────────────────────────────────────────────────────────────

interface SerperResult {
  organic?: Array<{
    title: string;
    link: string;
    snippet: string;
    domain?: string;
  }>;
  searchParameters?: {
    q: string;
  };
}

interface CollectedUrlData {
  url: string;
  domain: string;
  companyName: string | null;
}

/**
 * 指定ミリ秒待機する
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * URLからドメインを抽出する
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * ドメインから会社名を推測する
 */
function guessCompanyName(domain: string, title: string): string {
  // タイトルから会社名を抽出（「株式会社」「有限会社」等を含む部分）
  const companyPatterns = [
    /(.+?(?:株式会社|有限会社|合同会社|一般社団法人|NPO法人))/,
    /(株式会社.+?)(?:\s|$|｜|\|)/,
  ];

  for (const pattern of companyPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // ドメインから推測
  const domainParts = domain.split('.');
  return domainParts[0].replace(/-/g, ' ');
}

/**
 * Serper APIで検索してURLを収集する
 * @param query 検索クエリ
 * @param page ページ番号（1始まり）
 */
async function searchWithSerper(query: string, page: number = 1): Promise<CollectedUrlData[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    throw new Error('SERPER_API_KEY is not set');
  }

  const body: Record<string, unknown> = {
    q: query,
    gl: 'jp',
    hl: 'ja',
    num: 10,
  };

  // page=1 以外は Serper の page パラメータを使う
  if (page > 1) {
    body.page = page;
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Serper API error: ${response.status} ${error}`);
  }

  const data: SerperResult = await response.json();
  const results: CollectedUrlData[] = [];

  if (data.organic) {
    for (const item of data.organic) {
      const domain = extractDomain(item.link);

      // ブラックリスト・除外TLD・ブロックパスのURLはスキップ
      if (isBlockedDomain(domain)) {
        console.log(`  [BLOCKED domain] ${domain}`);
        continue;
      }
      if (isBlockedPath(item.link)) {
        console.log(`  [BLOCKED path] ${item.link}`);
        continue;
      }

      const companyName = guessCompanyName(domain, item.title);

      results.push({
        url: item.link,
        domain,
        companyName,
      });
    }
  }

  return results;
}

/**
 * ジョブのURLを収集してDBに保存する
 */
export async function collectUrls(jobId: string): Promise<number> {
  // ジョブ情報を取得
  const job = await prisma.listJob.findUnique({
    where: { id: jobId },
    include: { urls: true },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // 検索クエリを取得（jobのkeywordから再解析が必要な場合はanalyzeQueryを呼ぶ）
  // ここでは簡易的に業種と地域から生成
  const searchQueries = [
    `${job.industry || ''} ${job.location || ''} お問い合わせ`,
    `${job.industry || ''} ${job.location || ''} 会社概要`,
    `${job.industry || ''} ${job.location || ''} 企業一覧`,
    `${job.industry || ''} ${job.location || ''} contact`,
    `${job.industry || ''} ${job.location || ''} 会社`,
  ].filter(q => q.trim().length > 2);

  const collectedDomains = new Set<string>(job.urls.map(u => u.domain));
  const newUrls: CollectedUrlData[] = [];

  // targetCountに達するまで検索を繰り返す
  for (const query of searchQueries) {
    if (collectedDomains.size >= job.targetCount) {
      break;
    }

    try {
      console.log(`Searching: ${query}`);
      const results = await searchWithSerper(query);

      for (const result of results) {
        if (!collectedDomains.has(result.domain)) {
          collectedDomains.add(result.domain);
          newUrls.push(result);
        }
      }

      // API制限を考慮して少し待機
      await sleep(500);
    } catch (error) {
      console.error(`Search failed for query "${query}":`, error);
    }
  }

  // 各URLに対して企業情報をクローリングし、hasForm: trueのみ保存
  const totalCandidates = newUrls.length;
  let processed = 0;
  let saved = 0;

  for (const urlData of newUrls) {
    processed++;

    // 進捗を更新（0〜90%をクローリングフェーズに割り当て）
    const progress = Math.round((processed / totalCandidates) * 90);
    await prisma.listJob.update({
      where: { id: jobId },
      data: { progress },
    });

    try {
      console.log(`Scraping: ${urlData.url} (${processed}/${totalCandidates})`);
      const companyInfo = await scrapeCompanyInfo(urlData.url, job.industry ?? undefined);

      // hasForm: true のURLのみ保存
      if (companyInfo.hasForm) {
        await prisma.collectedUrl.create({
          data: {
            jobId,
            url: urlData.url,
            domain: urlData.domain,
            companyName: companyInfo.companyName ?? urlData.companyName,
            industry: companyInfo.industry ?? null,
            location: companyInfo.location ?? null,
            employeeCount: companyInfo.employeeCount ?? null,
            capitalAmount: companyInfo.capitalAmount ?? null,
            phoneNumber: companyInfo.phoneNumber ?? null,
            representativeName: companyInfo.representativeName ?? null,
            establishedYear: companyInfo.establishedYear ?? null,
            businessDescription: companyInfo.businessDescription ?? null,
            hasForm: true,
            formUrl: companyInfo.formUrl ?? null,
            status: 'collected',
          },
        });
        saved++;
        console.log(`  -> hasForm: true, saved (total: ${saved})`);
      } else {
        console.log(`  -> hasForm: false, skipped`);
      }
    } catch (error) {
      console.error(`Failed to scrape ${urlData.url}:`, error);
      // 1社の失敗で全体が止まらないようにcontinue
    }

    // レート制限対策: 各URL処理間に1秒待機
    if (processed < totalCandidates) {
      await sleep(1000);
    }
  }

  // ジョブの進捗を更新
  const totalFound = job.urls.length + saved;
  await prisma.listJob.update({
    where: { id: jobId },
    data: {
      totalFound,
      progress: 90,
    },
  });

  return totalFound;
}

/**
 * スクレイピング結果を保存するヘルパー関数
 * hasForm=true の場合は法人名クロールを実行して companyVerified を設定する
 * companyVerified=true の件数が targetCount に達したら true を返す
 */
async function scrapeAndSave(
  jobId: string,
  urlData: CollectedUrlData,
  requestedIndustry?: string
): Promise<boolean> {
  try {
    const companyInfo = await scrapeCompanyInfo(urlData.url, requestedIndustry);

    if (companyInfo.hasForm) {
      // isCompanySite: true かつ hasForm: true の場合のみここに到達
      const companyVerified = true;
      const companyName = companyInfo.companyName ?? urlData.companyName;

      console.log(`  -> hasForm: true, companyVerified: true (isCompanySite確認済み), saved`);

      await prisma.collectedUrl.create({
        data: {
          jobId,
          url: urlData.url,
          domain: urlData.domain,
          companyName,
          industry: companyInfo.industry ?? null,
          location: companyInfo.location ?? null,
          employeeCount: companyInfo.employeeCount ?? null,
          capitalAmount: companyInfo.capitalAmount ?? null,
          phoneNumber: companyInfo.phoneNumber ?? null,
          representativeName: companyInfo.representativeName ?? null,
          establishedYear: companyInfo.establishedYear ?? null,
          businessDescription: companyInfo.businessDescription ?? null,
          hasForm: true,
          formUrl: companyInfo.formUrl ?? null,
          companyVerified,
          status: 'collected',
        },
      });
      return companyVerified;
    } else {
      console.log(`  -> hasForm: false or not company site, skipped`);
      return false;
    }
  } catch (error) {
    console.error(`Failed to scrape ${urlData.url}:`, error);
    return false;
  }
}

/**
 * 複数の検索クエリを使って指定件数まで収集する。
 *
 * フォームなし企業が除外されても targetCount を必ず達成するよう、
 * スクレイピング済み件数が不足している間は追加 Serper 検索を繰り返す。
 *
 * 無限ループ防止:
 * - 検索ラウンドの上限: MAX_SEARCH_ROUNDS = ceil(MAX_SCRAPED_URLS / 10) + searchQueries.length
 * - 処理済み URL 上限: MAX_SCRAPED_URLS = max(targetCount * 10, 100)
 *   （フォーム検出率が低くても targetCount を達成できるよう広めに設定）
 *
 * キャッシュ機能:
 * - 同じ industry + location の過去1年以内のジョブから CollectedUrl を再利用
 * - キャッシュで足りれば Google 検索をスキップして即返す
 */
export async function collectUrlsWithQueries(
  jobId: string,
  searchQueries: string[],
  targetCount: number,
  userId: string,
  industry: string | null,
  location: string | null,
  industryKeywords: string[] = []
): Promise<{ totalFound: number; scrapedCount: number }> {
  const job = await prisma.listJob.findUnique({
    where: { id: jobId },
    include: { urls: true },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // ユーザーが過去に収集したdomain一覧を取得（重複排除用）
  const pastJobs = await prisma.listJob.findMany({
    where: {
      userId: userId,
      status: { in: ['completed', 'cancelled'] },
      id: { not: jobId },
    },
    select: { id: true },
  });

  const excludedDomains = new Set<string>();
  if (pastJobs.length > 0) {
    const pastUrls = await prisma.collectedUrl.findMany({
      where: {
        jobId: { in: pastJobs.map(j => j.id) },
      },
      select: { domain: true },
    });
    pastUrls.forEach(u => excludedDomains.add(u.domain));
  }

  console.log(`[Job ${jobId}] 除外ドメイン数: ${excludedDomains.size}`);

  // ─── キャッシュ検索（他ユーザーの1年以内の同条件データ） ───
  if (industry && location) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // industryKeywordsがある場合は配列オーバーラップ検索、なければ完全一致
    const cachedJobsRaw = await prisma.listJob.findMany({
      where: {
        id: { not: jobId },
        status: { in: ['completed', 'cancelled'] },
        location: location,
        createdAt: { gte: oneYearAgo },
        ...(industryKeywords.length > 0
          ? { industryKeywords: { hasSome: industryKeywords } }
          : { industry: industry }),
      },
      select: { id: true, industryKeywords: true },
    });

    // 一致率50%以上のジョブのみ使用
    const cachedJobs = industryKeywords.length > 0
      ? cachedJobsRaw.filter(job => {
          const threshold = Math.ceil(industryKeywords.length * 0.5);
          const overlap = job.industryKeywords.filter(k => industryKeywords.includes(k)).length;
          return overlap >= threshold;
        })
      : cachedJobsRaw;

    console.log(`[Job ${jobId}] キャッシュ候補ジョブ数: ${cachedJobsRaw.length} → フィルタ後: ${cachedJobs.length}`);

    let cachedUrls: Array<{
      id: string;
      jobId: string;
      url: string;
      domain: string;
      companyName: string | null;
      industry: string | null;
      location: string | null;
      employeeCount: string | null;
      capitalAmount: string | null;
      phoneNumber: string | null;
      representativeName: string | null;
      establishedYear: number | null;
      businessDescription: string | null;
      hasForm: boolean;
      formUrl: string | null;
      companyVerified: boolean;
      status: string;
      createdAt: Date;
    }> = [];

    if (cachedJobs.length > 0) {
      cachedUrls = await prisma.collectedUrl.findMany({
        where: {
          jobId: { in: cachedJobs.map(j => j.id) },
          domain: { notIn: Array.from(excludedDomains) },
          hasForm: true,
        },
      });
      // ブラックリスト再チェック（過去データがブラックリスト追加前に収集されている場合の対策）
      const beforeFilter = cachedUrls.length;
      cachedUrls = cachedUrls.filter(u => {
        if (isBlockedDomain(u.domain)) {
          console.log(`  [CACHE BLOCKED domain] ${u.domain}`);
          return false;
        }
        if (isBlockedPath(u.url)) {
          console.log(`  [CACHE BLOCKED path] ${u.url}`);
          return false;
        }
        return true;
      });
      if (beforeFilter !== cachedUrls.length) {
        console.log(`[Job ${jobId}] キャッシュブラックリスト除外: ${beforeFilter - cachedUrls.length} 件`);
      }
      // TODO: 将来的に companyVerified: true のみをキャッシュ対象にする
      // 現状は全データが companyVerified: false のため、有効化すると当面キャッシュが効かなくなる
      // cachedUrls = cachedUrls.filter(u => u.companyVerified);

      // ランダムシャッフル
      cachedUrls = cachedUrls.sort(() => Math.random() - 0.5);
      console.log(`[Job ${jobId}] キャッシュURL数（重複排除済み）: ${cachedUrls.length}`);
    }

    if (cachedUrls.length >= targetCount) {
      // キャッシュで十分: targetCount 件を選んで現在のジョブに紐付けてコピー保存
      const selected = cachedUrls.slice(0, targetCount);
      const now = new Date();
      await prisma.collectedUrl.createMany({
        data: selected.map(u => ({
          id: undefined, // createMany では id 省略で自動生成
          jobId,
          url: u.url,
          domain: u.domain,
          companyName: u.companyName,
          industry: u.industry,
          location: u.location,
          employeeCount: u.employeeCount,
          capitalAmount: u.capitalAmount,
          phoneNumber: u.phoneNumber,
          representativeName: u.representativeName,
          establishedYear: u.establishedYear,
          businessDescription: u.businessDescription,
          hasForm: u.hasForm,
          formUrl: u.formUrl,
          companyVerified: u.companyVerified,
          status: u.status,
          createdAt: now,
        })),
      });

      console.log(`[Job ${jobId}] キャッシュから ${targetCount} 件を保存して早期完了`);

      await prisma.listJob.update({
        where: { id: jobId },
        data: {
          totalFound: targetCount,
          progress: 90,
        },
      });

      return { totalFound: targetCount, scrapedCount: 0 };
    } else if (cachedUrls.length > 0) {
      // キャッシュが不足: キャッシュ分を先に保存
      const now = new Date();
      await prisma.collectedUrl.createMany({
        data: cachedUrls.map(u => ({
          jobId,
          url: u.url,
          domain: u.domain,
          companyName: u.companyName,
          industry: u.industry,
          location: u.location,
          employeeCount: u.employeeCount,
          capitalAmount: u.capitalAmount,
          phoneNumber: u.phoneNumber,
          representativeName: u.representativeName,
          establishedYear: u.establishedYear,
          businessDescription: u.businessDescription,
          hasForm: u.hasForm,
          formUrl: u.formUrl,
          companyVerified: u.companyVerified,
          status: u.status,
          createdAt: now,
        })),
      });
      // キャッシュのドメインを excludedDomains に追加（Google 収集時の重複防止）
      cachedUrls.forEach(u => excludedDomains.add(u.domain));
      console.log(`[Job ${jobId}] キャッシュから ${cachedUrls.length} 件を保存。残り ${targetCount - cachedUrls.length} 件をGoogle収集`);
    }
  }
  // ─────────────────────────────────────────────────────────────

  // 無限ループ防止の上限値
  // フォーム検出率が低い場合でも targetCount に到達できるよう、
  // 候補URL数の上限を targetCount * 10 に拡大（最低でも 100 件）
  const MAX_SCRAPED_URLS = Math.max(targetCount * 10, 100);  // スクレイピングするURL総数の上限
  const MAX_SEARCH_ROUNDS = Math.ceil(MAX_SCRAPED_URLS / 10) + searchQueries.length;

  // DB から現在のジョブの収集済み URL を再取得（キャッシュコピー分を含む）
  const savedUrlsAfterCache = await prisma.collectedUrl.findMany({
    where: { jobId },
    select: { domain: true, hasForm: true, companyVerified: true },
  });

  // 既収集ドメインの初期化（キャッシュで追加されたドメインも含む）
  const collectedDomains = new Set<string>(savedUrlsAfterCache.map(u => u.domain));
  // excludedDomains にも追加（Google 収集時の重複防止）
  savedUrlsAfterCache.forEach(u => excludedDomains.add(u.domain));

  // 処理待ちキュー（検索結果のURL）
  const pendingQueue: CollectedUrlData[] = [];

  // 統計（キャッシュで既に保存された分を初期値に）
  // savedCount = companyVerified=true の件数（目標件数カウント基準）
  let savedCount = savedUrlsAfterCache.filter(u => u.companyVerified).length;
  let scrapedTotal = 0;     // スクレイピング済みURL数
  let searchRound = 0;      // 実行した検索ラウンド数

  // キューにURLを補充する内部関数
  // searchQueries を page=1, 2, 3... と順番に試す
  async function fetchNextBatch(): Promise<boolean> {
    if (searchRound >= MAX_SEARCH_ROUNDS) {
      console.log(`Reached MAX_SEARCH_ROUNDS (${MAX_SEARCH_ROUNDS}), stopping.`);
      return false;
    }

    // searchQueries をローテーション: round 0〜N-1 → page1, round N〜2N-1 → page2, ...
    const queryIndex = searchRound % searchQueries.length;
    const page = Math.floor(searchRound / searchQueries.length) + 1;
    const query = searchQueries[queryIndex];

    searchRound++;
    console.log(`[Search round ${searchRound}] query="${query}" page=${page}`);

    try {
      const results = await searchWithSerper(query, page);
      let added = 0;
      for (const result of results) {
        if (!collectedDomains.has(result.domain)) {
          collectedDomains.add(result.domain);
          pendingQueue.push(result);
          added++;
        }
      }
      console.log(`  -> ${added} new URLs added to queue (queue size: ${pendingQueue.length})`);
      await sleep(500);
      return true;
    } catch (error) {
      console.error(`Search failed (round ${searchRound}):`, error);
      return true; // エラーでも試行継続
    }
  }

  // searchQueries と結果件数を記録する配列
  const queryResults: Array<{ query: string; resultCount: number }> = [];

  // 初回の検索バッチを全クエリ分実行してキューを温める
  for (let i = 0; i < searchQueries.length; i++) {
    const queueBefore = pendingQueue.length;
    await fetchNextBatch();
    const added = pendingQueue.length - queueBefore;
    queryResults.push({ query: searchQueries[i], resultCount: Math.max(added, 0) });
  }

  // searchQueries をDBに保存
  try {
    await prisma.listJob.update({
      where: { id: jobId },
      data: { searchQueries: JSON.stringify(queryResults) },
    });
    console.log(`[Job ${jobId}] searchQueries saved: ${queryResults.length} queries`);
  } catch (e) {
    console.error(`[Job ${jobId}] Failed to save searchQueries:`, e);
  }

  // メインループ: targetCount 達成 or 上限に達するまでスクレイピング & 追加検索
  while (savedCount < targetCount && scrapedTotal < MAX_SCRAPED_URLS) {
    // キューが空になったら追加検索
    if (pendingQueue.length === 0) {
      const fetched = await fetchNextBatch();
      if (!fetched || pendingQueue.length === 0) {
        console.log('No more URLs available, stopping.');
        break;
      }
    }

    const urlData = pendingQueue.shift()!;
    scrapedTotal++;

    // 進捗を更新（0〜90%をスクレイピングフェーズに割り当て）
    // savedCount / targetCount ベースで進捗を計算
    const progressByCount = Math.round((savedCount / targetCount) * 90);
    const progressByScraped = Math.round((scrapedTotal / MAX_SCRAPED_URLS) * 90);
    const progress = Math.min(Math.max(progressByCount, progressByScraped), 89);
    await prisma.listJob.update({
      where: { id: jobId },
      data: { progress },
    });

    // キャンセルチェック: DBのstatusを確認して中断判断
    const currentJob = await prisma.listJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (currentJob?.status === 'cancelled') {
      console.log(`[Job ${jobId}] キャンセルを検出。処理を中断します。`);
      break;
    }

    // ユーザー単位の重複排除: 過去ジョブで収集済みのドメインはスキップ
    if (excludedDomains.has(urlData.domain)) {
      console.log(`  -> [重複スキップ] ${urlData.domain} は過去に収集済み`);
      continue;
    }

    console.log(
      `Scraping: ${urlData.url} ` +
      `(scraped: ${scrapedTotal}/${MAX_SCRAPED_URLS}, saved: ${savedCount}/${targetCount})`
    );

    const wasSaved = await scrapeAndSave(jobId, urlData, industry ?? undefined);
    if (wasSaved) {
      savedCount++;
    }

    // targetCount 達成で早期終了
    if (savedCount >= targetCount) {
      console.log(`Target count ${targetCount} reached!`);
      break;
    }

    // レート制限対策
    await sleep(1000);
  }

  const totalFound = savedCount;

  await prisma.listJob.update({
    where: { id: jobId },
    data: {
      totalFound,
      progress: 90,
    },
  });

  console.log(
    `collectUrlsWithQueries done: savedCount=${savedCount}, ` +
    `scrapedTotal=${scrapedTotal}, searchRounds=${searchRound}`
  );

  return { totalFound, scrapedCount: scrapedTotal };
}
