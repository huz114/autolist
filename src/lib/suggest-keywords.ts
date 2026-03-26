/**
 * キーワード提案モジュール
 *
 * Gemini APIを使って、元のキーワードから代替キーワードを3つ生成する。
 * - 類義語（美容室→ヘアサロン、美容院）
 * - エリア拡大（渋谷区→目黒区、世田谷区）
 * - 関連業種
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logGeminiUsage } from "@/lib/gemini-usage-logger";

/**
 * 元のキーワードから代替キーワードを3つ提案する
 *
 * @param keyword 元の検索キーワード（例: 「美容室 渋谷区 30社」）
 * @returns 代替キーワードの配列（最大3つ）
 */
export async function suggestAlternativeKeywords(keyword: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[suggestAlternativeKeywords] GEMINI_API_KEY is not set');
    return [];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  const prompt = `あなたは営業リスト収集の専門家です。

以下のキーワードで企業リストを検索しましたが、十分な数の企業が見つかりませんでした。
より多くの企業が見つかる可能性のある代替キーワードを3つ提案してください。

元のキーワード: 「${keyword}」

提案の方針:
1. 業種の類義語や関連業種（例: 美容室 → ヘアサロン、美容院）
2. 近隣エリアへの拡大（例: 渋谷区 → 目黒区、世田谷区）
3. より広い括りのキーワード（例: 歯科クリニック 港区 → 歯科医院 東京都）

各提案は「業種 地域 件数」の形式で、元のキーワードと同じ件数にしてください。
件数が不明な場合は30社としてください。

JSON配列のみ返してください。余計な説明は不要です。
例: ["ヘアサロン 渋谷区 30社", "美容室 目黒区 30社", "美容院 世田谷区 30社"]`;

  try {
    const result = await model.generateContent(prompt);
    await logGeminiUsage('suggestKeywords', result.response.usageMetadata);
    const responseText = result.response.text();

    // JSON配列を抽出
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      console.error('[suggestAlternativeKeywords] Failed to parse Gemini response');
      return [];
    }

    const suggestions: string[] = JSON.parse(jsonMatch[0]);

    // 最大3つに制限し、空文字列を除外
    return suggestions
      .filter(s => typeof s === 'string' && s.trim().length > 0)
      .slice(0, 3);
  } catch (error) {
    console.error('[suggestAlternativeKeywords] Gemini API error:', error);
    return [];
  }
}
