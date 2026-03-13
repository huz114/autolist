-- CreateTable
CREATE TABLE "LineUser" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "monthlyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "targetCount" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ListJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectedUrl" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "companyName" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "employeeCount" TEXT,
    "capitalAmount" TEXT,
    "phoneNumber" TEXT,
    "representativeName" TEXT,
    "hasForm" BOOLEAN NOT NULL DEFAULT false,
    "formUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'collected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectedUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineUser_lineUserId_key" ON "LineUser"("lineUserId");

-- AddForeignKey
ALTER TABLE "ListJob" ADD CONSTRAINT "ListJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "LineUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectedUrl" ADD CONSTRAINT "CollectedUrl_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ListJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
