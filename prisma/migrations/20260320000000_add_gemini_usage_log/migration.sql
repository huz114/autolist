-- CreateTable
CREATE TABLE "GeminiUsageLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "source" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCostJpy" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeminiUsageLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GeminiUsageLog" ADD CONSTRAINT "GeminiUsageLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ListJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
