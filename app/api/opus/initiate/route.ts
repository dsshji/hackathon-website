import { NextResponse } from "next/server";
import { initiateJob } from "@/lib/opus";

export async function POST() {
  try {
    const result = await initiateJob();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
