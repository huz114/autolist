import { GoogleGenerativeAI } from '@google/generative-ai';
import { logGeminiUsage } from '@/lib/gemini-usage-logger';

export interface AnalyzedQuery {
  industry: string;
  location: string;
  targetCount: number;
  industryKeywords: string[];
  searchQueries: string[];
  excludeTerms: string[];
  isDomestic: boolean;
  industrySpecified: boolean;
  locationSpecified: boolean;
  countSpecified: boolean;
}

/**
 * 全国に複数存在する曖昧な区名リスト
 */
const AMBIGUOUS_WARD_NAMES = [
  '西区', '東区', '南区', '北区', '中区', '中央区', '緑区', '港区',
];

/**
 * locationが曖昧な区名のみかどうかを判定する
 * 都道府県や市名が含まれていれば曖昧ではないと判定
 * @returns 曖昧な場合はその区名を返す。曖昧でなければnull
 */
export function checkAmbiguousLocation(location: string): string | null {
  if (!location) return null;

  const trimmed = location.trim();

  // 曖昧な区名リストに完全一致するかチェック
  if (AMBIGUOUS_WARD_NAMES.includes(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Gemini APIを使って自然言語のクエリを解析し、検索条件を抽出する
 * 例: 「IT企業 東京 100社リストして」
 * → { industry: "IT・情報通信", location: "東京", targetCount: 100, searchQueries: [...] }
 */
export async function analyzeQuery(userMessage: string): Promise<AnalyzedQuery> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const prompt = `あなたはビジネスリスト収集サービスのクエリ解析AIです。
ユーザーのメッセージから以下の情報を抽出し、JSON形式で返してください。

抽出する情報:
1. industry: ユーザーが指定したビジネスタイプをできるだけそのまま抽出（例: "新築専門不動産会社", "ラーメン専門店", "訪問介護事業所", "税理士事務所", "Web制作会社"）。大カテゴリに丸めず、ユーザーの具体的な指定を尊重すること。業種が指定されていない場合は空文字""を返す。
2. location: 地域（例: "東京", "大阪府", "愛知県名古屋市"）。地域が指定されていない場合は空文字""を返す。
3. targetCount: 収集したい企業数（数字のみ）。件数が明示されていない場合は0を返す。
4. isDomestic: 指定された地域が日本国内かどうか（true/false）。地域が指定されていない場合はtrue。海外の地域（例: ニューヨーク、上海、ロンドン、ソウル等）の場合はfalse。
5. industrySpecified: ユーザーが業種を明示的に指定したか（true/false）
6. locationSpecified: ユーザーが地域を明示的に指定したか（true/false）
7. countSpecified: ユーザーが件数を明示的に指定したか（true/false）
8. industryKeywords: industryを構成する重要キーワードの配列（2〜5個）。
   例: "新築専門不動産会社" → ["新築", "不動産", "会社"]
       "訪問介護事業所" → ["訪問介護", "介護", "事業所"]
       "ラーメン専門店" → ["ラーメン", "専門店", "飲食"]
   日本語の意味単位で分割し、検索に有効なキーワードのみ残すこと。業種未指定の場合は空配列[]。
9. searchQueries: Google検索クエリの配列（4〜6個）
10. excludeTerms: ユーザーが求めている業種と紛らわしい関連業種・支援業種のキーワードを配列で返してください。
   これらの除外キーワードはGoogle検索で除外演算子(-"keyword")として使用されます。
   以下の6カテゴリを網羅的に考え、該当するものを全て含めてください（最大15個）:

   (A) 機器・設備メーカー: その業種向けの機械・設備・ソフトウェアを製造・販売する会社
       例: 自動車整備工場 → "整備機器", "整備リフト", "機器メーカー", "設備販売"
       例: 歯科医院 → "歯科材料", "歯科機器", "デンタル用品"
   (B) 関連だが異なる業種: 同じ分野だがユーザーが求めていない別業態
       例: 自動車整備工場 → "バス会社", "運輸", "タクシー", "レンタカー", "中古車販売", "カーディーラー", "自動車教習所"
       例: 通販事業者 → "ECカート", "通販代行", "物流代行", "フルフィルメント"
   (C) コンサル・支援業: その業種向けのコンサルティング・支援サービス
       例: "コンサル", "コンサルティング", "支援", "開業支援"
   (D) 業界団体・公的機関: 協会・組合・行政機関
       例: "協会", "組合", "連合会", "商工会", "公社", "財団法人", "独立行政法人"
   (E) 卸売・問屋: ユーザーが小売やサービス業を求めている場合の卸売業者
       例: "卸売", "問屋", "商社", "ディストリビューター"
   (F) ニュース・メディア・ポータル: 企業ではなく情報サイト
       例: "ニュース", "まとめ", "ランキング", "口コミ", "比較サイト"

   重要: ユーザーが求めている業種そのものを除外しないこと。あくまで紛らわしい周辺業種のみ除外する。
   紛らわしい業種がない場合は空配列[]を返してください。

searchQueriesの生成ルール:
- industryの完全な表現を使ったクエリ（1〜2個）
  例: "新築専門不動産会社 東京 お問い合わせ"
- industryKeywordsを組み合わせたクエリ（2〜3個）
  例: "新築 不動産会社 東京 企業一覧", "新築住宅 不動産 東京"
- 英語混在クエリ（1個）
  例: "新築 不動産 東京 contact"

必ずJSON形式のみで返してください。他のテキストは不要です。

例1:
入力: 「新築専門不動産会社 東京 100社リストして」
出力: {
  "industry": "新築専門不動産会社",
  "location": "東京",
  "targetCount": 100,
  "isDomestic": true,
  "industrySpecified": true,
  "locationSpecified": true,
  "countSpecified": true,
  "industryKeywords": ["新築", "不動産", "会社"],
  "searchQueries": [
    "新築専門不動産会社 東京 お問い合わせ",
    "新築専門不動産会社 東京 会社概要",
    "新築 不動産会社 東京 企業一覧",
    "新築住宅 不動産 東京",
    "新築 不動産 東京 contact"
  ],
  "excludeTerms": ["不動産コンサル", "不動産投資", "不動産管理システム", "不動産協会", "不動産組合", "賃貸管理", "中古マンション", "リフォーム", "不動産ニュース"]
}

例2:
入力: 「IT企業」
出力: {
  "industry": "IT企業",
  "location": "",
  "targetCount": 0,
  "isDomestic": true,
  "industrySpecified": true,
  "locationSpecified": false,
  "countSpecified": false,
  "industryKeywords": ["IT", "企業", "情報通信"],
  "searchQueries": [],
  "excludeTerms": ["IT コンサル", "SES", "システム派遣", "IT協会", "情報処理推進機構", "ITニュース", "IT比較", "IT商社"]
}

ユーザーメッセージ: ${userMessage}`;

  const result = await model.generateContent(prompt);
  await logGeminiUsage('analyzeQuery', result.response.usageMetadata);
  const text = result.response.text();

  try {
    // JSONを抽出（コードブロックがある場合も対応）
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const parsed = JSON.parse(jsonText) as AnalyzedQuery;

    // 未指定フラグのバリデーション
    parsed.industrySpecified = parsed.industrySpecified !== false && !!parsed.industry;
    parsed.locationSpecified = parsed.locationSpecified !== false && !!parsed.location;
    parsed.countSpecified = parsed.countSpecified !== false && parsed.targetCount > 0;
    if (typeof parsed.isDomestic !== 'boolean') parsed.isDomestic = true;

    // デフォルト値の補完（未指定の場合も空文字/0のまま保持）
    if (!parsed.industry) parsed.industry = '';
    if (!parsed.location) parsed.location = '';
    if (!parsed.targetCount || parsed.targetCount < 0) parsed.targetCount = 0;
    if (!parsed.industryKeywords || parsed.industryKeywords.length === 0) {
      parsed.industryKeywords = parsed.industry ? [parsed.industry] : [];
    }
    if (!parsed.excludeTerms || !Array.isArray(parsed.excludeTerms)) {
      parsed.excludeTerms = [];
    }
    if (!parsed.searchQueries || parsed.searchQueries.length === 0) {
      if (parsed.industry && parsed.location) {
        parsed.searchQueries = [
          `${parsed.industry} ${parsed.location} お問い合わせ`,
          `${parsed.industry} ${parsed.location} 会社概要`,
          `${parsed.industry} ${parsed.location} contact`,
        ];
      } else {
        parsed.searchQueries = [];
      }
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('クエリの解析に失敗しました。もう少し具体的に入力してください。');
  }
}
