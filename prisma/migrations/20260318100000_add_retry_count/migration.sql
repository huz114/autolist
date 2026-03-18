-- AlterTable: ListJobにretryCountカラムを追加（自動リトライ回数の追跡用）
ALTER TABLE "ListJob" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
