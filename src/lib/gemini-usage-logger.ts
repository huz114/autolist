import { prisma } from '@/lib/prisma'

// Gemini 2.5 Flash pricing (USD per 1M tokens)
const INPUT_PRICE_PER_1M = 0.15  // $0.15/1M input tokens
const OUTPUT_PRICE_PER_1M = 0.60 // $0.60/1M output tokens
const USD_TO_JPY = 150 // 概算レート

export type GeminiUsageSource = 'analyzeQuery' | 'scrapeCompany' | 'suggestKeywords' | 'compose'

export async function logGeminiUsage(
  source: GeminiUsageSource,
  usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined,
  jobId?: string | null
) {
  if (!usageMetadata) return

  const inputTokens = usageMetadata.promptTokenCount || 0
  const outputTokens = usageMetadata.candidatesTokenCount || 0

  const inputCostUsd = (inputTokens / 1_000_000) * INPUT_PRICE_PER_1M
  const outputCostUsd = (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M
  const estimatedCostJpy = (inputCostUsd + outputCostUsd) * USD_TO_JPY

  console.log(`[GeminiUsage] ${source}: input=${inputTokens}, output=${outputTokens}, cost=¥${estimatedCostJpy.toFixed(4)}${jobId ? `, jobId=${jobId}` : ''}`)

  try {
    await prisma.geminiUsageLog.create({
      data: {
        jobId: jobId || null,
        source,
        inputTokens,
        outputTokens,
        estimatedCostJpy,
      }
    })
  } catch (error) {
    console.error('[GeminiUsage] Failed to log:', error)
  }
}
