import { prisma } from './prisma';
import { scrapeCompanyInfo } from './scrape-company';

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
      const companyInfo = await scrapeCompanyInfo(urlData.url);

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
 */
async function scrapeAndSave(
  jobId: string,
  urlData: CollectedUrlData
): Promise<boolean> {
  try {
    const companyInfo = await scrapeCompanyInfo(urlData.url);

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
          hasForm: true,
          formUrl: companyInfo.formUrl ?? null,
          status: 'collected',
        },
      });
      console.log(`  -> hasForm: true, saved`);
      return true;
    } else {
      console.log(`  -> hasForm: false, skipped`);
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
 * - 検索ラウンドの上限: MAX_SEARCH_ROUNDS = targetCount * 3 / 10 (切り上げ)
 * - 処理済み URL 上限: targetCount * 3
 */
export async function collectUrlsWithQueries(
  jobId: string,
  searchQueries: string[],
  targetCount: number
): Promise<number> {
  const job = await prisma.listJob.findUnique({
    where: { id: jobId },
    include: { urls: true },
  });

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  // 無限ループ防止の上限値
  const MAX_SCRAPED_URLS = targetCount * 3;       // スクレイピングするURL総数の上限
  const MAX_SEARCH_ROUNDS = Math.ceil(MAX_SCRAPED_URLS / 10) + searchQueries.length;

  // 既収集ドメインの初期化
  const collectedDomains = new Set<string>(job.urls.map(u => u.domain));

  // 処理待ちキュー（検索結果のURL）
  const pendingQueue: CollectedUrlData[] = [];

  // 統計
  let savedCount = job.urls.filter(u => u.hasForm).length; // 既存のフォームあり件数
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

  // 初回の検索バッチを全クエリ分実行してキューを温める
  for (let i = 0; i < searchQueries.length; i++) {
    await fetchNextBatch();
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

    console.log(
      `Scraping: ${urlData.url} ` +
      `(scraped: ${scrapedTotal}/${MAX_SCRAPED_URLS}, saved: ${savedCount}/${targetCount})`
    );

    const wasSaved = await scrapeAndSave(jobId, urlData);
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

  return totalFound;
}
