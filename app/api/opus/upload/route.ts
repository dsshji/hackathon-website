import { NextRequest, NextResponse } from "next/server";
import { getUploadUrl, uploadFileToPresigned } from "@/lib/opus";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    const { presignedUrl, fileUrl } = await getUploadUrl(extension);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadFileToPresigned(presignedUrl, buffer, file.type || "application/pdf");

    return NextResponse.json({ fileUrl, fileName: file.name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
