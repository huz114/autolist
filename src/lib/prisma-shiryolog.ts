import { PrismaClient } from '../generated/prisma-shiryolog'

const globalForPrisma = globalThis as unknown as {
  prismaShiryolog: PrismaClient
}

export const prismaShiryolog =
  globalForPrisma.prismaShiryolog ||
  new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prismaShiryolog = prismaShiryolog
