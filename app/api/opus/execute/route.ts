import { NextRequest, NextResponse } from "next/server";
import { executeJob } from "@/lib/opus";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobExecutionId, jobPayloadSchemaInstance } = body;

    if (!jobExecutionId || !jobPayloadSchemaInstance) {
      return NextResponse.json(
        { error: "Missing jobExecutionId or jobPayloadSchemaInstance" },
        { status: 400 }
      );
    }

    const result = await executeJob(jobExecutionId, jobPayloadSchemaInstance);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
