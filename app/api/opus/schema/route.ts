import { NextResponse } from "next/server";
import { getWorkflowSchema } from "@/lib/opus";

export async function GET() {
  try {
    const schema = await getWorkflowSchema();
    return NextResponse.json(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[v0] Schema route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
