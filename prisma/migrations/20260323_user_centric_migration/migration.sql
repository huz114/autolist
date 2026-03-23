-- DropForeignKey
ALTER TABLE "ListJob" DROP CONSTRAINT "ListJob_userId_fkey";

-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_userId_fkey";

-- AlterTable
ALTER TABLE "LineUser" DROP COLUMN "credits",
DROP COLUMN "monthlyCount",
DROP COLUMN "plan";
