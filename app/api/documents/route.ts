import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const configuration = await prisma.configuration.findFirst({
      where: { userId: userId },
    });

    if (!configuration) {
      return NextResponse.json({ error: "No configuration found for the user." }, { status: 404 });
    }

    return NextResponse.json({
      id: configuration.id,
      fileName: configuration.fileName,
      excelUrl: configuration.excelUrl,
      wordUrl: configuration.wordUrl,
      generatedExcel: configuration.generatedExcel, // Remplacez cette ligne
      createdAt: configuration.createdAt,
      updatedAt: configuration.updatedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
