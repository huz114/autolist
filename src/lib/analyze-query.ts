import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AnalyzedQuery {
  industry: string;
  location: string;
  targetCount: number;
  searchQueries: string[];
}

/**
 * Gemini APIを使って自然言語のクエリを解析し、検索条件を抽出する
 * 例: 「IT企業 東京 100社リストして」
 * → { industry: "IT・情報通信", location: "東京", targetCount: 100, searchQueries: [...] }
 */
export async function analyzeQuery(userMessage: string): Promise<AnalyzedQuery> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `あなたはビジネスリスト収集サービスのクエリ解析AIです。
ユーザーのメッセージから以下の情報を抽出し、JSON形式で返してください。

抽出する情報:
1. industry: 業種・業界（例: "IT・情報通信", "飲食業", "製造業", "小売業", "医療・福祉", "建設業", "不動産業"）
2. location: 地域（例: "東京", "大阪府", "愛知県名古屋市"）
3. targetCount: 収集したい企業数（数字のみ、デフォルト100）
4. searchQueries: Google検索クエリの配列（3〜5個、日本語と英語混在で多様な角度から）

searchQueriesの生成ルール:
- "{業種} {地域} お問い合わせ" パターン
- "{業種} {地域} 会社概要" パターン
- "{業種} {地域} 企業一覧" パターン
- "{業種} {地域} contact" パターン（英語）
- 具体的なキーワードを含むパターン

必ずJSON形式のみで返してください。他のテキストは不要です。

例:
入力: 「IT企業 東京 100社リストして」
出力: {
  "industry": "IT・情報通信",
  "location": "東京",
  "targetCount": 100,
  "searchQueries": [
    "IT企業 東京 お問い合わせ",
    "情報通信 東京 会社概要",
    "ソフトウェア会社 東京 企業一覧",
    "IT企業 東京 contact",
    "システム開発 東京 会社"
  ]
}

ユーザーメッセージ: ${userMessage}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    // JSONを抽出（コードブロックがある場合も対応）
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const parsed = JSON.parse(jsonText) as AnalyzedQuery;

    // バリデーション
    if (!parsed.industry) parsed.industry = '一般企業';
    if (!parsed.location) parsed.location = '日本';
    if (!parsed.targetCount || parsed.targetCount <= 0) parsed.targetCount = 100;
    if (!parsed.searchQueries || parsed.searchQueries.length === 0) {
      parsed.searchQueries = [
        `${parsed.industry} ${parsed.location} お問い合わせ`,
        `${parsed.industry} ${parsed.location} 会社概要`,
        `${parsed.industry} ${parsed.location} contact`,
      ];
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse Gemini response:', text);
    throw new Error('クエリの解析に失敗しました。もう少し具体的に入力してください。');
  }
}
