import { prismaShiryolog } from './prisma-shiryolog'
import { prisma } from './prisma'

/**
 * 完了したジョブの CollectedUrl をシリョログの Company テーブルにインポートする
 * domainフィールドで重複チェック（upsert）
 * @param jobId - オートリストのジョブID
 * @returns インポートに成功した件数
 */
export async function importJobToShiryolog(jobId: string): Promise<number> {
  const urls = await prisma.collectedUrl.findMany({
    where: { jobId },
  })

  let importedCount = 0

  for (const url of urls) {
    // domainが空の場合はスキップ
    if (!url.domain || url.domain.trim() === '') {
      console.warn(`Skipping CollectedUrl ${url.id}: empty domain`)
      continue
    }

    // companyNameが空の場合もスキップ（Companyのname は必須フィールド）
    if (!url.companyName || url.companyName.trim() === '') {
      console.warn(`Skipping CollectedUrl ${url.id}: empty companyName`)
      continue
    }

    try {
      const contactType = url.hasForm && url.formUrl ? 'form' : 'none'

      await prismaShiryolog.company.upsert({
        where: { domain: url.domain },
        create: {
          name: url.companyName,
          domain: url.domain,
          officialUrl: url.url,
          industry: url.industry ?? null,
          region: url.location ?? null,
          companySize: url.employeeCount ?? null,
          contactUrl: url.formUrl ?? null,
          contactType,
          status: 'DISCOVERED',
          source: 'autolist',
        },
        update: {
          // 既存レコードは情報があれば上書き
          name: url.companyName,
          officialUrl: url.url,
          industry: url.industry ?? undefined,
          region: url.location ?? undefined,
          companySize: url.employeeCount ?? undefined,
          contactUrl: url.formUrl ?? undefined,
          contactType,
          source: 'autolist',
        },
      })

      importedCount++
    } catch (e) {
      // 個別エラーはスキップ（全体処理を止めない）
      console.error(`Failed to import domain=${url.domain}:`, e)
    }
  }

  return importedCount
}
