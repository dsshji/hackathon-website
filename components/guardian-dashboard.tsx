"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  FileText,
  Send,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploadCard } from "@/components/file-upload-card";
import { JobStatusTracker } from "@/components/job-status-tracker";
import { ResultsViewer } from "@/components/results-viewer";

type JobPhase =
  | "idle"
  | "initiating"
  | "uploading"
  | "executing"
  | "polling"
  | "completed"
  | "failed";

interface UploadedFile {
  fileUrl: string;
  fileName: string;
}

interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
}

const FILE_INPUTS = [
  {
    key: "smeta",
    label: "SMETA Audit Report PDF",
    description:
      "Upload the SMETA Audit Report PDF file containing the audit results.",
  },
  {
    key: "iso",
    label: "ISO 14001 Certification PDF",
    description:
      "Upload the ISO 14001 certification PDF document to extract validity dates and scope.",
  },
  {
    key: "registration",
    label: "Registration Certificate PDF",
    description:
      "Upload the registration certificate PDF file with the official company details.",
  },
  {
    key: "conduct",
    label: "Supplier Code of Conduct PDF",
    description:
      "Upload the supplier's code of conduct document file (PDF or similar).",
  },
];

export function GuardianDashboard() {
  const [files, setFiles] = useState<Record<string, UploadedFile>>({});
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [jobExecutionId, setJobExecutionId] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);

  const allFilesUploaded = FILE_INPUTS.every(
    (f) => files[f.key]?.fileUrl
  );

  const handleFileUploaded = useCallback(
    (key: string, fileUrl: string, fileName: string) => {
      setFiles((prev) => ({
        ...prev,
        [key]: { fileUrl, fileName },
      }));
    },
    []
  );

  const fetchSchema = useCallback(async () => {
    const res = await fetch("/api/opus/schema");
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Failed to fetch workflow schema (HTTP ${res.status})`);
    }
    return data.jobPayloadSchema;
  }, []);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleExecute = useCallback(async () => {
    try {
      // Step 1: Get schema
      setPhase("initiating");
      setProgress(5);
      setStatusMessage("Fetching workflow schema...");

      let workflowSchema = schema;
      if (!workflowSchema) {
        workflowSchema = await fetchSchema();
        setSchema(workflowSchema);
      }

      // Step 2: Initiate job
      setProgress(15);
      setStatusMessage("Initiating compliance analysis job...");

      const initiateRes = await fetch("/api/opus/initiate", {
        method: "POST",
      });
      if (!initiateRes.ok) {
        const err = await initiateRes.json();
        throw new Error(err.error || "Failed to initiate job");
      }
      const initiateData = await initiateRes.json();
      const execId = initiateData.jobExecutionId;
      setJobExecutionId(execId);

      // Step 3: Build the payload from schema and uploaded files
      setPhase("uploading");
      setProgress(30);
      setStatusMessage("Preparing document payload...");

      // Map our file keys to the workflow variable names from schema
      const schemaEntries = Object.entries(
        workflowSchema as Record<string, { variable_name: string; display_name: string; type: string }>
      );

      // Match file inputs to schema variables by display name
      const fileMapping: Record<string, string> = {};
      for (const input of FILE_INPUTS) {
        const match = schemaEntries.find(([, v]) => {
          const displayLower = v.display_name?.toLowerCase() || "";
          const labelLower = input.label.toLowerCase();
          return (
            displayLower.includes(labelLower.split(" ")[0].toLowerCase()) ||
            labelLower.includes(displayLower.split(" ")[0].toLowerCase()) ||
            displayLower === labelLower
          );
        });
        if (match) {
          fileMapping[input.key] = match[0];
        }
      }

      // If we couldn't match by display name, assign by order
      const unmappedKeys = FILE_INPUTS.filter(
        (f) => !fileMapping[f.key]
      ).map((f) => f.key);
      const unmappedSchema = schemaEntries.filter(
        ([key]) => !Object.values(fileMapping).includes(key)
      );
      unmappedKeys.forEach((key, i) => {
        if (unmappedSchema[i]) {
          fileMapping[key] = unmappedSchema[i][0];
        }
      });

      // Build jobPayloadSchemaInstance
      const jobPayloadSchemaInstance: Record<string, unknown> = {};
      for (const input of FILE_INPUTS) {
        const varName = fileMapping[input.key];
        if (varName && files[input.key]?.fileUrl) {
          const schemaEntry = (workflowSchema as Record<string, { display_name: string; type: string }>)[varName];
          jobPayloadSchemaInstance[varName] = {
            value: files[input.key].fileUrl,
            type: schemaEntry?.type || "file",
            displayName: schemaEntry?.display_name || input.label,
          };
        }
      }

      // Step 4: Execute
      setPhase("executing");
      setProgress(50);
      setStatusMessage("Submitting documents for compliance analysis...");

      const executeRes = await fetch("/api/opus/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobExecutionId: execId,
          jobPayloadSchemaInstance,
        }),
      });

      if (!executeRes.ok) {
        const err = await executeRes.json();
        throw new Error(err.error || "Failed to execute job");
      }

      // Step 5: Poll for status
      setPhase("polling");
      setProgress(60);
      setStatusMessage(
        "Analyzing supplier documents against EU CSDDD and ILO standards..."
      );

      let status = "IN PROGRESS";
      let pollCount = 0;
      while (status === "IN PROGRESS") {
        await sleep(5000);
        pollCount++;
        setProgress(Math.min(60 + pollCount * 3, 95));

        const statusRes = await fetch(
          `/api/opus/status?jobExecutionId=${execId}`
        );
        if (!statusRes.ok) throw new Error("Failed to check job status");
        const statusData = await statusRes.json();
        status = statusData.status;

        if (pollCount % 3 === 0) {
          const messages = [
            "Validating supplier legal registration...",
            "Checking ethical commitment disclosures...",
            "Cross-referencing sustainability certifications...",
            "Detecting policy vs. audit discrepancies...",
            "Generating regulatory compliance report...",
          ];
          setStatusMessage(
            messages[Math.min(Math.floor(pollCount / 3) - 1, messages.length - 1)]
          );
        }
      }

      if (status === "FAILED") {
        throw new Error("Job execution failed on the Opus platform.");
      }

      // Step 6: Get results (with retry since there can be a delay after COMPLETED)
      setProgress(96);
      setStatusMessage("Retrieving compliance analysis results...");

      let resultsData: Record<string, unknown> | null = null;
      let resultsRetry = 0;
      const maxResultsRetries = 12;

      while (resultsRetry < maxResultsRetries) {
        const resultsRes = await fetch(
          `/api/opus/results?jobExecutionId=${execId}`
        );

        if (resultsRes.status === 202) {
          // Results not ready yet, keep waiting
          resultsRetry++;
          setProgress(96 + Math.min(resultsRetry, 3));
          setStatusMessage(
            `Finalizing results... (attempt ${resultsRetry}/${maxResultsRetries})`
          );
          await sleep(5000);
          continue;
        }

        if (!resultsRes.ok) {
          throw new Error("Failed to retrieve results");
        }

        resultsData = await resultsRes.json();
        break;
      }

      if (!resultsData) {
        throw new Error(
          "Results not available after multiple attempts. The job may still be finalizing -- please try fetching results again in a moment."
        );
      }

      setResults(resultsData);

      // Fetch audit log now that results are confirmed
      try {
        const auditRes = await fetch(
          `/api/opus/audit?jobExecutionId=${execId}`
        );
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditTrail(auditData.auditTrail || []);
        }
      } catch {
        // Audit log is non-critical, don't fail the whole flow
      }

      setProgress(100);
      setPhase("completed");
      setStatusMessage("Compliance analysis complete.");
      toast.success("Compliance analysis completed successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unknown error occurred";
      setPhase("failed");
      setStatusMessage(message);
      toast.error("Analysis failed", { description: message });
    }
  }, [files, schema, fetchSchema]);

  const handleReset = useCallback(() => {
    setFiles({});
    setPhase("idle");
    setJobExecutionId("");
    setStatusMessage("");
    setProgress(0);
    setResults(null);
    setAuditTrail([]);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">
                Project Guardian
              </h1>
              <p className="text-xs text-muted-foreground">
                Vendor Risk & Compliance Monitoring
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider">
              EU CSDDD
            </span>
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider">
              ILO Standards
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Hero section */}
        {phase === "idle" && !results && (
          <div className="mb-8">
            <div className="rounded-xl border border-border bg-card p-8">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-foreground tracking-tight text-balance">
                  Automated Supplier Compliance Analysis
                </h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Upload your supplier documentation to validate legal
                  registration, verify ethical commitments and sustainability
                  certifications, detect discrepancies between stated policies
                  and independent audits, and generate audit-ready regulatory
                  compliance reports.
                </p>
                <div className="mt-4 flex flex-wrap gap-4">
                  {[
                    "Legal Registration Validation",
                    "Ethical Commitment Verification",
                    "Sustainability Certification Check",
                    "Policy vs. Audit Discrepancy Detection",
                    "Regulatory Compliance Reporting",
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <ArrowRight className="h-3 w-3 text-accent" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results view */}
        {phase === "completed" && results && (
          <div className="space-y-6">
            <JobStatusTracker
              phase={phase}
              jobExecutionId={jobExecutionId}
              statusMessage={statusMessage}
              progress={progress}
            />
            <ResultsViewer
              jobExecutionId={jobExecutionId}
              results={results}
              auditTrail={auditTrail}
              onClose={handleReset}
            />
          </div>
        )}

        {/* In-progress view */}
        {phase !== "idle" && phase !== "completed" && (
          <div className="space-y-6">
            <JobStatusTracker
              phase={phase}
              jobExecutionId={jobExecutionId}
              statusMessage={statusMessage}
              progress={progress}
            />
            {phase === "failed" && (
              <div className="flex justify-center">
                <Button onClick={handleReset} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start Over
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Upload section */}
        {phase === "idle" && !results && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Required Documents
                </h3>
                <span className="text-xs text-muted-foreground">
                  ({Object.values(files).filter((f) => f.fileUrl).length}/
                  {FILE_INPUTS.length} uploaded)
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {FILE_INPUTS.map((input) => (
                  <FileUploadCard
                    key={input.key}
                    label={input.label}
                    description={input.description}
                    accept=".pdf,.docx"
                    onFileUploaded={(fileUrl, fileName) =>
                      handleFileUploaded(input.key, fileUrl, fileName)
                    }
                    uploadedFileUrl={files[input.key]?.fileUrl}
                    uploadedFileName={files[input.key]?.fileName}
                  />
                ))}
              </div>
            </div>

            {/* Warning for missing files */}
            {!allFilesUploaded && Object.keys(files).length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-chart-3/30 bg-chart-3/5 p-4">
                <AlertTriangle className="h-4 w-4 text-chart-3 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Missing Documents
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All four documents are required to run a complete compliance
                    analysis. Please upload the remaining files.
                  </p>
                </div>
              </div>
            )}

            {/* Execute button */}
            <div className="flex justify-end">
              <Button
                size="lg"
                disabled={!allFilesUploaded}
                onClick={handleExecute}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Run Compliance Analysis
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 mt-12">
        <div className="mx-auto max-w-5xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Powered by Opus AI &mdash; Applied AI
          </p>
          <p className="text-xs text-muted-foreground">
            EU CSDDD & ILO Forced Labor Indicators Compliant
          </p>
        </div>
      </footer>
    </div>
  );
}
