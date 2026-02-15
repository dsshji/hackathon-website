import { NextRequest, NextResponse } from "next/server";
import { getJobResults } from "@/lib/opus";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobExecutionId = searchParams.get("jobExecutionId");

    if (!jobExecutionId) {
      return NextResponse.json(
        { error: "Missing jobExecutionId" },
        { status: 400 }
      );
    }

    const result = await getJobResults(jobExecutionId);
    
    if (!result.ready) {
      return NextResponse.json({ ready: false }, { status: 202 });
    }
    
    return NextResponse.json({ ready: true, ...result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
