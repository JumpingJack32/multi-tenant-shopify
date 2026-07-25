import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const SECRET = process.env.REVALIDATION_SECRET;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, tag } = body;

    if (!secret || !SECRET || secret !== SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!tag || typeof tag !== "string") {
      return NextResponse.json({ error: "Missing tag" }, { status: 400 });
    }

    revalidateTag(tag, {} as any);

    return NextResponse.json({ revalidated: true, tag });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
