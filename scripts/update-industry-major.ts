/**
 * CollectedUrl.industryMajor 一括更新スクリプト
 *
 * Step 1: 既存の表記ゆれを業種マスター正式名称に正規化
 * Step 2: industry → industryMajor マッピング（NULLのものを埋める）
 *
 * 実行: npx tsx scripts/update-industry-major.ts
 */

import { PrismaClient } from '@prisma/client'
import { INDUSTRY_MASTER, INDUSTRY_MAJOR_LIST } from '../src/lib/industry-master'

const prisma = new PrismaClient()

// ===== Step 1: 表記ゆれ正規化マッピング =====
const NORMALIZE_MAP: Record<string, string> = {
  '不動産業、物品賃貸業': '建設・不動産',
  '不動産業・物品賃貸業': '建設・不動産',
  '不動産業, 物品賃貸業': '建設・不動産',
  '不動産業': '建設・不動産',
  '不動産・物品賃貸業': '建設・不動産',
  '建設業': '建設・不動産',
}

// ===== Step 2: industry → industryMajor キーワードマッピング =====
// 小分類キーワード → 大分類
function buildKeywordMap(): Array<{ keywords: string[]; major: string }> {
  const rules: Array<{ keywords: string[]; major: string }> = []

  // 特定キーワード → 大分類（優先度高い順）
  // 不動産関連
  rules.push({ keywords: ['不動産', '宅地建物'], major: '建設・不動産' })
  rules.push({ keywords: ['建設', '建築', '工務店', '土木', '内装', 'リフォーム', '設備工事'], major: '建設・不動産' })

  // IT関連
  rules.push({ keywords: ['IT', 'システム開発', 'ソフトウェア', 'SaaS', 'クラウド', 'Web制作', 'アプリ開発', 'プログラミング', 'DX', 'ICT'], major: 'IT・情報通信' })
  rules.push({ keywords: ['情報サービス', '情報処理', '情報通信', '電気通信'], major: 'IT・情報通信' })

  // 製造業
  rules.push({ keywords: ['製造', 'メーカー', '食品加工'], major: '製造業' })

  // 小売業
  rules.push({ keywords: ['小売', '通販', '通信販売', 'EC事業', 'Eコマース', 'EC・通販', 'オフィス用品通販', 'スポーツ用品通販'], major: '小売業' })

  // 卸売・商社
  rules.push({ keywords: ['卸売', '商社', '卸販売'], major: '卸売・商社' })

  // サービス業（ビジネス支援）
  rules.push({ keywords: ['コンサルティング', '人材サービス', '人材派遣', '広告', 'マーケティング', 'PR', 'イベント', 'BPO', '翻訳', 'リサーチ', '研修'], major: 'サービス業（ビジネス支援）' })

  // 金融・保険
  rules.push({ keywords: ['銀行', '証券', '保険', 'リース', 'レンタル', 'ファンド', 'フィンテック', '信販'], major: '金融・保険' })

  // 医療・福祉
  rules.push({ keywords: ['医療', '病院', 'クリニック', '介護', '福祉', '老人ホーム', '薬局', '歯科', '動物病院', '臨床検査'], major: '医療・福祉' })

  // 教育・学習
  rules.push({ keywords: ['教育', '学習塾', '予備校', '幼稚園', '保育', '語学', 'スクール', 'eラーニング'], major: '教育・学習' })

  // 飲食・宿泊
  rules.push({ keywords: ['飲食', 'レストラン', '居酒屋', 'ホテル', '旅館', 'カフェ', 'ラーメン', 'ファストフード', '給食'], major: '飲食・宿泊' })

  // 運輸・物流
  rules.push({ keywords: ['運送', '物流', '海運', '航空', '引越', '宅配', '鉄道', 'バス', 'タクシー'], major: '運輸・物流' })

  // 電気・ガス・エネルギー
  rules.push({ keywords: ['電力', 'ガス供給', '太陽光', 'エネルギー', '石油', '燃料', '省エネ'], major: '電気・ガス・エネルギー' })

  // 農業・林業・水産業
  rules.push({ keywords: ['農業', '林業', '水産', '畜産', '農機'], major: '農業・林業・水産業' })

  // メディア・出版
  rules.push({ keywords: ['出版', 'テレビ', 'ラジオ', '映像', '動画制作', '音楽', 'メディア'], major: 'メディア・出版' })

  // 士業・専門サービス
  rules.push({ keywords: ['弁護士', '法律事務所', '税理士', '会計事務所', '社会保険労務士', '行政書士', '司法書士', '特許事務所', '弁理士', '建築士事務所', '公認会計士'], major: '士業・専門サービス' })

  // 美容・生活関連
  rules.push({ keywords: ['美容', 'エステ', 'リラクゼーション', 'フィットネス', 'ジム', 'クリーニング', '冠婚葬祭', 'ペット', 'ネイル', 'ビューティ'], major: '美容・生活関連' })

  // 娯楽・レジャー
  rules.push({ keywords: ['旅行', 'アミューズメント', 'スポーツ施設', '映画館', '劇場', 'パチンコ', 'レジャー'], major: '娯楽・レジャー' })

  // 環境・廃棄物処理
  rules.push({ keywords: ['廃棄物', 'リサイクル', '資源回収', '水処理', '環境', '解体工事', '不用品回収'], major: '環境・廃棄物処理' })

  // 公共・団体
  rules.push({ keywords: ['自治体', '行政法人', '財団', '社団', '協会', '団体', 'NPO', 'NGO', '地方公共'], major: '公共・団体' })

  // 自動車関連
  rules.push({ keywords: ['自動車修理', '自動車整備', '鈑金', '塗装', '自動車販売', 'ディーラー'], major: '小売業' })

  return rules
}

function mapIndustryToMajor(industry: string): string | null {
  const rules = buildKeywordMap()

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (industry.includes(kw)) {
        return rule.major
      }
    }
  }

  return null // マッピングできない
}

async function main() {
  console.log('===== CollectedUrl industryMajor 一括更新 =====\n')

  // 更新前の状態確認
  const beforeDist = await prisma.$queryRaw<Array<{ industryMajor: string | null; cnt: number }>>`
    SELECT "industryMajor", COUNT(*)::int as cnt
    FROM "autolist"."CollectedUrl"
    GROUP BY "industryMajor"
    ORDER BY cnt DESC
  `
  console.log('【更新前】industryMajor分布:')
  beforeDist.forEach(r => console.log(`  ${r.industryMajor ?? 'NULL'}: ${r.cnt}件`))
  console.log()

  // ===== Step 1: 表記ゆれ正規化 =====
  console.log('--- Step 1: 表記ゆれ正規化 ---')
  let step1Total = 0
  for (const [oldVal, newVal] of Object.entries(NORMALIZE_MAP)) {
    const result = await prisma.$executeRaw`
      UPDATE "autolist"."CollectedUrl"
      SET "industryMajor" = ${newVal}
      WHERE "industryMajor" = ${oldVal}
    `
    if (result > 0) {
      console.log(`  "${oldVal}" → "${newVal}": ${result}件`)
      step1Total += result
    }
  }
  console.log(`  Step 1 合計: ${step1Total}件更新\n`)

  // ===== Step 2: industry → industryMajor マッピング =====
  console.log('--- Step 2: industry → industryMajor マッピング ---')
  const nullRows = await prisma.$queryRaw<Array<{ id: string; industry: string }>>`
    SELECT id, industry
    FROM "autolist"."CollectedUrl"
    WHERE ("industryMajor" IS NULL OR "industryMajor" = '')
      AND industry IS NOT NULL AND industry != ''
  `
  console.log(`  対象: ${nullRows.length}件`)

  let step2Updated = 0
  let step2Unmapped = 0
  const unmappedList: string[] = []

  for (const row of nullRows) {
    const major = mapIndustryToMajor(row.industry)
    if (major) {
      await prisma.$executeRaw`
        UPDATE "autolist"."CollectedUrl"
        SET "industryMajor" = ${major}
        WHERE id = ${row.id}
      `
      step2Updated++
    } else {
      step2Unmapped++
      if (!unmappedList.includes(row.industry)) {
        unmappedList.push(row.industry)
      }
    }
  }
  console.log(`  マッピング成功: ${step2Updated}件`)
  console.log(`  マッピング不可: ${step2Unmapped}件`)
  if (unmappedList.length > 0) {
    console.log(`  未分類のindustry値:`)
    unmappedList.forEach(v => console.log(`    - ${v}`))
  }
  console.log()

  // 更新後の状態確認
  const afterDist = await prisma.$queryRaw<Array<{ industryMajor: string | null; cnt: number }>>`
    SELECT "industryMajor", COUNT(*)::int as cnt
    FROM "autolist"."CollectedUrl"
    GROUP BY "industryMajor"
    ORDER BY cnt DESC
  `
  console.log('【更新後】industryMajor分布:')
  afterDist.forEach(r => console.log(`  ${r.industryMajor ?? 'NULL'}: ${r.cnt}件`))

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
