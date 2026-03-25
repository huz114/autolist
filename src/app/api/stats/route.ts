import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const completedCount = await prisma.listJob.count({
      where: { status: "completed" },
    });
    return NextResponse.json({ completedCount });
  } catch {
    return NextResponse.json({ completedCount: 0 });
  }
}
