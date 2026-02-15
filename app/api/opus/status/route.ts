import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/opus";

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

    const result = await getJobStatus(jobExecutionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
