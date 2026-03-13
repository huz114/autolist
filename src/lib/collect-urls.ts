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
 */
async function searchWithSerper(query: string): Promise<CollectedUrlData[]> {
  const apiKey = process.env.SERPER_API_KEY;

  if (!apiKey) {
    throw new Error('SERPER_API_KEY is not set');
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'jp',
      hl: 'ja',
      num: 10,
    }),
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
 * 複数の検索クエリを使って指定件数まで収集する
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

  const collectedDomains = new Set<string>(job.urls.map(u => u.domain));
  const newUrls: CollectedUrlData[] = [];

  for (const query of searchQueries) {
    if (collectedDomains.size >= targetCount) {
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

        if (collectedDomains.size >= targetCount) {
          break;
        }
      }

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
    const progress = Math.round((processed / Math.max(totalCandidates, 1)) * 90);
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
