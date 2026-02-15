const OPUS_BASE_URL = "https://operator.opus.com";
const WORKFLOW_ID = "I9mMVOEQwjdOewLf";

function getServiceKey() {
  const key = process.env.OPUS_SERVICE_KEY;
  if (!key) throw new Error("OPUS_SERVICE_KEY environment variable is not set. Please add it in the Vars section of the sidebar.");
  return key;
}

function opusHeaders(): Record<string, string> {
  return {
    "x-service-key": getServiceKey(),
    "Content-Type": "application/json",
  };
}

export async function getWorkflowSchema() {
  const res = await fetch(`${OPUS_BASE_URL}/workflow/${WORKFLOW_ID}`, {
    method: "GET",
    headers: opusHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Opus API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function initiateJob() {
  const res = await fetch(`${OPUS_BASE_URL}/job/initiate`, {
    method: "POST",
    headers: opusHeaders(),
    body: JSON.stringify({ workflowId: WORKFLOW_ID }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to initiate job: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getUploadUrl(fileExtension: string) {
  const res = await fetch(`${OPUS_BASE_URL}/job/file/upload`, {
    method: "POST",
    headers: opusHeaders(),
    body: JSON.stringify({
      fileExtension,
      accessScope: "organization",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get upload URL: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ presignedUrl: string; fileUrl: string }>;
}

export async function uploadFileToPresigned(
  presignedUrl: string,
  fileBuffer: Buffer,
  contentType: string
) {
  const res = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileBuffer,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload file to S3: ${res.status}`);
  }
  return true;
}

export async function executeJob(
  jobExecutionId: string,
  jobPayloadSchemaInstance: Record<string, unknown>
) {
  const res = await fetch(`${OPUS_BASE_URL}/job/execute`, {
    method: "POST",
    headers: opusHeaders(),
    body: JSON.stringify({
      jobExecutionId,
      jobPayloadSchemaInstance,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to execute job: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getJobStatus(jobExecutionId: string) {
  const res = await fetch(
    `${OPUS_BASE_URL}/job/${jobExecutionId}/status`,
    {
      method: "GET",
      headers: opusHeaders(),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get job status: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ status: string }>;
}

export async function getJobResults(jobExecutionId: string): Promise<{
  ready: boolean;
  data?: Record<string, unknown>;
  statusCode?: number;
}> {
  const res = await fetch(
    `${OPUS_BASE_URL}/job/${jobExecutionId}/results`,
    {
      method: "GET",
      headers: opusHeaders(),
    }
  );

  // 202 means results are not ready yet (job is still finalizing)
  if (res.status === 202) {
    return { ready: false, statusCode: 202 };
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get job results: ${res.status} ${text}`);
  }

  const json = await res.json();
  return { ready: true, data: json };
}

export async function getJobAuditLog(jobExecutionId: string) {
  const res = await fetch(
    `${OPUS_BASE_URL}/job/${jobExecutionId}/audit`,
    {
      method: "GET",
      headers: opusHeaders(),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get audit log: ${res.status} ${text}`);
  }
  return res.json();
}
