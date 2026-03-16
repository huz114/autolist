/**
 * 法人格なし会社名の修正スクリプト
 *
 * ジョブ cmmt5otdt0001mx0pbxr3r84j の CollectedUrl で
 * companyName に法人格が含まれていないレコードを特定し、
 * scrapeCompanyInfo で再取得して更新する。
 *
 * 2026-03-16: 以下4件を手動確認・SQL直接UPDATEで修正済み
 *   - INFORCE GROUP → 株式会社インフォースグループ
 *   - アイティフォー → 株式会社アイティフォー
 *   - アンテロープキャリアコンサルティング → アンテロープキャリアコンサルティング株式会社
 *   - システムフロア → 株式会社システムフロア
 *
 * 今後同様の問題が発生した場合は、このスクリプトを参考に
 * scrapeCompanyInfo を使った自動修正を実装できる。
 *
 * 使い方（将来用）:
 *   npx tsx scripts/fix-company-names.ts [jobId]
 */

import { PrismaClient } from "@prisma/client";
import { scrapeCompanyInfo } from "../src/lib/scrape-company";

const CORPORATE_ENTITY_PATTERN =
  /株式会社|有限会社|合同会社|一般社団法人|医療法人|Co\.,?\s*Ltd|Inc\.|Ltd\.|Corp\./;

async function main() {
  const jobId = process.argv[2] || "cmmt5otdt0001mx0pbxr3r84j";
  const prisma = new PrismaClient();

  try {
    // 法人格なしレコードを取得
    const records = await prisma.collectedUrl.findMany({
      where: {
        jobId,
        companyName: { not: null },
      },
    });

    const targets = records.filter(
      (r) => r.companyName && !CORPORATE_ENTITY_PATTERN.test(r.companyName)
    );

    if (targets.length === 0) {
      console.log("法人格なしレコードはありません。");
      return;
    }

    console.log(`法人格なしレコード: ${targets.length}件`);

    for (const record of targets) {
      console.log(`\n処理中: ${record.companyName} (${record.url})`);

      try {
        const info = await scrapeCompanyInfo(record.url);
        if (info.companyName && CORPORATE_ENTITY_PATTERN.test(info.companyName)) {
          await prisma.collectedUrl.update({
            where: { id: record.id },
            data: { companyName: info.companyName },
          });
          console.log(`  更新: ${record.companyName} → ${info.companyName}`);
        } else {
          console.log(`  スキップ: 法人格を含む名前を取得できず`);
        }
      } catch (err) {
        console.log(`  エラー: ${err}`);
      }

      // API レート制限対策
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("\n完了");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
