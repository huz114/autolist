-- AlterTable: Add updatedAt with default value for existing rows
ALTER TABLE "ListJob" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now();
