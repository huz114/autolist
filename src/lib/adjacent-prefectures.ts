/**
 * 都道府県隣接リスト
 * 陸続き・フェリー等で実質隣接する都道府県を定義
 */
export const ADJACENT_PREFECTURES: Record<string, string[]> = {
  '北海道': ['青森'],
  '青森': ['北海道', '岩手', '秋田'],
  '岩手': ['青森', '秋田', '宮城'],
  '宮城': ['岩手', '秋田', '山形', '福島'],
  '秋田': ['青森', '岩手', '宮城', '山形'],
  '山形': ['秋田', '宮城', '福島', '新潟'],
  '福島': ['宮城', '山形', '新潟', '栃木', '群馬', '茨城'],
  '茨城': ['福島', '栃木', '埼玉', '千葉'],
  '栃木': ['福島', '茨城', '群馬', '埼玉'],
  '群馬': ['福島', '栃木', '埼玉', '新潟', '長野'],
  '埼玉': ['茨城', '栃木', '群馬', '東京', '千葉', '長野', '山梨'],
  '千葉': ['茨城', '埼玉', '東京'],
  '東京': ['神奈川', '埼玉', '千葉', '山梨'],
  '神奈川': ['東京', '山梨', '静岡'],
  '新潟': ['山形', '福島', '群馬', '長野', '富山'],
  '富山': ['新潟', '長野', '岐阜', '石川'],
  '石川': ['富山', '岐阜', '福井'],
  '福井': ['石川', '岐阜', '滋賀', '京都'],
  '山梨': ['東京', '埼玉', '神奈川', '長野', '静岡'],
  '長野': ['群馬', '埼玉', '新潟', '富山', '岐阜', '愛知', '静岡', '山梨'],
  '岐阜': ['富山', '石川', '福井', '長野', '愛知', '三重', '滋賀'],
  '静岡': ['神奈川', '山梨', '長野', '愛知'],
  '愛知': ['長野', '岐阜', '静岡', '三重'],
  '三重': ['岐阜', '愛知', '滋賀', '奈良', '和歌山'],
  '滋賀': ['福井', '岐阜', '三重', '京都'],
  '京都': ['福井', '滋賀', '大阪', '兵庫', '奈良'],
  '大阪': ['京都', '兵庫', '奈良', '和歌山'],
  '兵庫': ['京都', '大阪', '奈良', '鳥取', '岡山'],
  '奈良': ['京都', '大阪', '三重', '和歌山'],
  '和歌山': ['三重', '大阪', '奈良'],
  '鳥取': ['兵庫', '島根', '岡山'],
  '島根': ['鳥取', '広島', '山口'],
  '岡山': ['兵庫', '鳥取', '広島'],
  '広島': ['島根', '岡山', '山口'],
  '山口': ['島根', '広島', '福岡'],
  '徳島': ['香川', '愛媛', '高知'],
  '香川': ['徳島', '愛媛'],
  '愛媛': ['香川', '徳島', '高知'],
  '高知': ['徳島', '愛媛'],
  '福岡': ['山口', '佐賀', '熊本', '大分'],
  '佐賀': ['福岡', '長崎'],
  '長崎': ['佐賀'],
  '熊本': ['福岡', '大分', '宮崎', '鹿児島'],
  '大分': ['福岡', '熊本', '宮崎'],
  '宮崎': ['熊本', '大分', '鹿児島'],
  '鹿児島': ['熊本', '宮崎'],
  '沖縄': [],
};

/**
 * 都道府県名のサフィックスパターン
 */
const PREFECTURE_SUFFIXES = ['都', '道', '府', '県'];

/**
 * locationから都道府県名を抽出する
 * 例: "東京都渋谷区" → "東京", "大阪府" → "大阪", "神奈川" → "神奈川"
 */
function extractPrefectureName(location: string): string | null {
  const prefectureNames = Object.keys(ADJACENT_PREFECTURES);

  // まず完全一致を試みる（サフィックスなし）
  if (prefectureNames.includes(location)) {
    return location;
  }

  // サフィックス（都道府県）を除去して照合
  for (const suffix of PREFECTURE_SUFFIXES) {
    if (location.endsWith(suffix)) {
      const withoutSuffix = location.slice(0, -suffix.length);
      if (prefectureNames.includes(withoutSuffix)) {
        return withoutSuffix;
      }
    }
  }

  // locationが「東京都渋谷区」のように長い場合、前方一致で都道府県名を探す
  for (const name of prefectureNames) {
    if (location.startsWith(name)) {
      return name;
    }
    // サフィックス付きでの前方一致（例: "東京都"で始まる）
    for (const suffix of PREFECTURE_SUFFIXES) {
      if (location.startsWith(name + suffix)) {
        return name;
      }
    }
  }

  return null;
}

/**
 * locationから近隣都道府県のリストを返す
 * @param location - 例: "東京", "東京都", "東京都渋谷区"
 * @returns 近隣都道府県名の配列（見つからない場合は空配列）
 */
export function getAdjacentPrefectures(location: string): string[] {
  const prefName = extractPrefectureName(location);
  if (!prefName) {
    return [];
  }
  return ADJACENT_PREFECTURES[prefName] ?? [];
}
