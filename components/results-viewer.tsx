"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  CheckCircle2,
  Info,
  ScrollText,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Types ---

interface OutputVariable {
  id: string;
  variable_name: string;
  display_name: string;
  description: string;
  display_description: string;
  value: unknown;
  type: string;
  type_definition?: Record<string, unknown>;
  [key: string]: unknown;
}

interface Discrepancy {
  document_name?: string;
  flag_type?: string;
  location?: string;
  description?: string;
  severity?: string;
  [key: string]: unknown;
}

interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
}

interface ResultsViewerProps {
  jobExecutionId: string;
  results: Record<string, unknown> | null;
  auditTrail: AuditEntry[];
  onClose: () => void;
}

// --- Helpers ---

function parseOutputVariables(results: Record<string, unknown>): OutputVariable[] {
  const schema =
    (results as Record<string, unknown>).jobResultsPayloadSchema ||
    results;

  if (!schema || typeof schema !== "object") return [];

  return Object.values(schema as Record<string, unknown>).filter(
    (v): v is OutputVariable =>
      typeof v === "object" &&
      v !== null &&
      "variable_name" in (v as Record<string, unknown>) &&
      "value" in (v as Record<string, unknown>)
  );
}

function classifyVariable(v: OutputVariable): "confidence" | "risk" | "discrepancy" | "other" {
  const name = (v.variable_name || "").toLowerCase();
  const display = (v.display_name || "").toLowerCase();

  if (display.includes("risk score") || name.includes("risk_score")) return "risk";
  if (display.includes("discrepanc") || name.includes("discrepanc")) return "discrepancy";
  if (
    display.includes("confidence") ||
    name.includes("confidence") ||
    (v.type === "float" && typeof v.value === "number" && v.value >= 0 && v.value <= 1)
  )
    return "confidence";
  return "other";
}

function getConfidenceColor(value: number): string {
  if (value >= 0.9) return "text-emerald-600";
  if (value >= 0.7) return "text-amber-600";
  return "text-red-600";
}

function getConfidenceBarColor(value: number): string {
  if (value >= 0.9) return "bg-emerald-500";
  if (value >= 0.7) return "bg-amber-500";
  return "bg-red-500";
}

function getConfidenceLabel(value: number): string {
  if (value >= 0.95) return "Excellent";
  if (value >= 0.9) return "Strong";
  if (value >= 0.7) return "Moderate";
  if (value >= 0.5) return "Weak";
  return "Critical";
}

function getRiskLevel(score: number): { label: string; color: string; bg: string; icon: typeof ShieldCheck } {
  if (score <= 3) return { label: "Low Risk", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: ShieldCheck };
  if (score <= 6) return { label: "Medium Risk", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: ShieldAlert };
  return { label: "High Risk", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: ShieldX };
}

function getSeverityStyle(severity: string): { badge: string; dot: string } {
  const s = (severity || "").toLowerCase();
  if (s === "high" || s === "critical")
    return { badge: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" };
  if (s === "medium" || s === "moderate")
    return { badge: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" };
  return { badge: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500" };
}

// --- Sub-components ---

function ConfidenceGauge({ variable }: { variable: OutputVariable }) {
  const value = typeof variable.value === "number" ? variable.value : 0;
  const percentage = Math.round(value * 100);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground leading-tight">
            {variable.display_name}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {variable.display_description || variable.description}
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs">{variable.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", getConfidenceBarColor(value))}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={cn("text-xl font-bold tabular-nums", getConfidenceColor(value))}>
            {percentage}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0",
            value >= 0.9 ? "border-emerald-300 text-emerald-700" :
            value >= 0.7 ? "border-amber-300 text-amber-700" :
            "border-red-300 text-red-700"
          )}
        >
          {getConfidenceLabel(value)}
        </Badge>
        <span className="text-[10px] text-muted-foreground font-mono">
          {variable.variable_name}
        </span>
      </div>
    </div>
  );
}

function RiskScorePanel({ variable }: { variable: OutputVariable }) {
  const score = typeof variable.value === "number" ? variable.value : 0;
  const risk = getRiskLevel(score);
  const RiskIcon = risk.icon;

  return (
    <div className={cn("rounded-xl border-2 p-6", risk.bg)}>
      <div className="flex items-start gap-4">
        <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", risk.color, "bg-white/60")}>
          <RiskIcon className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className={cn("text-2xl font-bold tabular-nums", risk.color)}>
              {score}/10
            </h3>
            <Badge className={cn("text-xs font-bold uppercase", risk.color, "bg-white/60 border-0")}>
              {risk.label}
            </Badge>
          </div>
          <p className="text-sm font-medium text-foreground mt-1">
            {variable.display_name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {variable.display_description || variable.description}
          </p>
        </div>
      </div>

      {/* Risk bar visualization */}
      <div className="mt-4">
        <div className="flex items-center gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2.5 flex-1 rounded-sm transition-colors",
                i < score
                  ? score <= 3 ? "bg-emerald-400" : score <= 6 ? "bg-amber-400" : "bg-red-400"
                  : "bg-black/10"
              )}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">Low</span>
          <span className="text-[10px] text-muted-foreground">High</span>
        </div>
      </div>
    </div>
  );
}

function DiscrepancyCard({ discrepancy, index }: { discrepancy: Discrepancy; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const severity = (discrepancy.severity || "low").toString();
  const style = getSeverityStyle(severity);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={cn("mt-1 h-2.5 w-2.5 rounded-full shrink-0", style.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
            {discrepancy.flag_type && (
              <Badge variant="outline" className="text-[10px] font-semibold">
                {String(discrepancy.flag_type)}
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", style.badge)}>
              {severity}
            </Badge>
          </div>
          <p className="text-sm font-medium text-foreground mt-1.5 leading-relaxed">
            {discrepancy.description || "No description provided"}
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {discrepancy.document_name && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Document
                </dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {String(discrepancy.document_name)}
                </dd>
              </div>
            )}
            {discrepancy.location && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Location
                </dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {String(discrepancy.location)}
                </dd>
              </div>
            )}
            {discrepancy.flag_type && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Flag Type
                </dt>
                <dd className="text-sm text-foreground mt-0.5">
                  {String(discrepancy.flag_type)}
                </dd>
              </div>
            )}
            {discrepancy.severity && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Severity
                </dt>
                <dd className="text-sm text-foreground mt-0.5 capitalize">
                  {String(discrepancy.severity)}
                </dd>
              </div>
            )}
            {/* Render any extra fields not covered above */}
            {Object.entries(discrepancy)
              .filter(([k]) => !["document_name", "flag_type", "location", "description", "severity"].includes(k))
              .map(([key, val]) => (
                <div key={key}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </dt>
                  <dd className="text-sm text-foreground mt-0.5">
                    {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function DiscrepancyList({ variable }: { variable: OutputVariable }) {
  const items: Discrepancy[] = Array.isArray(variable.value)
    ? (variable.value as Discrepancy[])
    : [];

  const severityCounts = items.reduce<Record<string, number>>((acc, d) => {
    const s = (d.severity || "unknown").toString().toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">
            {variable.display_name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {variable.display_description || variable.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(severityCounts).map(([severity, count]) => {
            const style = getSeverityStyle(severity);
            return (
              <Badge key={severity} variant="outline" className={cn("text-xs font-semibold", style.badge)}>
                {count} {severity}
              </Badge>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-emerald-800">No discrepancies detected</p>
          <p className="text-xs text-emerald-600 mt-0.5">All supplier documents are consistent.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((discrepancy, i) => (
            <DiscrepancyCard key={i} discrepancy={discrepancy} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function OtherVariableDisplay({ variable }: { variable: OutputVariable }) {
  const [expanded, setExpanded] = useState(false);
  const value = variable.value;
  const isComplex = typeof value === "object" && value !== null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{variable.display_name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {variable.display_description || variable.description}
          </p>
        </div>
        {isComplex && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </div>
      <div className="mt-2">
        {isComplex ? (
          expanded ? (
            <pre className="text-xs font-mono text-foreground bg-muted/50 rounded-md p-3 overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(value, null, 2)}
            </pre>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              {Array.isArray(value)
                ? `Array with ${(value as unknown[]).length} items`
                : `Object with ${Object.keys(value as Record<string, unknown>).length} keys`}
            </span>
          )
        ) : (
          <span className="text-base font-semibold text-foreground font-mono">{String(value)}</span>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export function ResultsViewer({
  jobExecutionId,
  results,
  auditTrail,
  onClose,
}: ResultsViewerProps) {
  if (!results) return null;

  const variables = parseOutputVariables(results);

  const confidenceVars = variables.filter((v) => classifyVariable(v) === "confidence");
  const riskVars = variables.filter((v) => classifyVariable(v) === "risk");
  const discrepancyVars = variables.filter((v) => classifyVariable(v) === "discrepancy");
  const otherVars = variables.filter((v) => classifyVariable(v) === "other");

  // Derive overall status from risk score
  const riskScore = riskVars.length > 0 && typeof riskVars[0].value === "number"
    ? riskVars[0].value
    : null;

  const overallStatus =
    riskScore !== null
      ? riskScore <= 3 ? "APPROVED" : riskScore <= 6 ? "PENDING REVIEW" : "REJECTED"
      : null;

  const statusStyle =
    overallStatus === "APPROVED"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : overallStatus === "PENDING REVIEW"
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-red-100 text-red-800 border-red-300";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Compliance Analysis Report
            </h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Job ID: {jobExecutionId}
            </p>
          </div>
          {overallStatus && (
            <Badge
              variant="outline"
              className={cn("text-xs font-bold uppercase tracking-wider px-3 py-1", statusStyle)}
            >
              {overallStatus}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          New Analysis
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-6 h-auto py-0">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
            Overview
          </TabsTrigger>
          {discrepancyVars.length > 0 && (
            <TabsTrigger
              value="discrepancies"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs"
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Discrepancies
              {discrepancyVars[0] && Array.isArray(discrepancyVars[0].value) && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive/15 px-1 text-[10px] font-bold text-destructive">
                  {(discrepancyVars[0].value as unknown[]).length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger
            value="raw"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Raw Data
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs"
          >
            <ScrollText className="h-3.5 w-3.5 mr-1.5" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="m-0">
          <div className="p-6 space-y-6">
            {/* Risk Score */}
            {riskVars.map((v) => (
              <RiskScorePanel key={v.id || v.variable_name} variable={v} />
            ))}

            {/* Confidence Scores */}
            {confidenceVars.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">
                    Document Confidence Scores
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  OCR-derived confidence scores for each submitted supplier document. Scores above 90% indicate high verification confidence.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {confidenceVars.map((v) => (
                    <ConfidenceGauge key={v.id || v.variable_name} variable={v} />
                  ))}
                </div>
              </div>
            )}

            {/* Discrepancy Summary */}
            {discrepancyVars.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-foreground">
                      Discrepancy Summary
                    </h3>
                  </div>
                  {discrepancyVars.map((v) => {
                    const items = Array.isArray(v.value) ? v.value as Discrepancy[] : [];
                    if (items.length === 0) {
                      return (
                        <div key={v.id || v.variable_name} className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                          <p className="text-sm font-medium text-emerald-800">No discrepancies found</p>
                        </div>
                      );
                    }
                    return (
                      <div key={v.id || v.variable_name} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-medium text-amber-800">
                          {items.length} discrepanc{items.length === 1 ? "y" : "ies"} detected
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                          Review the Discrepancies tab for detailed information on each flagged item.
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Other variables */}
            {otherVars.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">
                    Additional Outputs
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {otherVars.map((v) => (
                      <OtherVariableDisplay key={v.id || v.variable_name} variable={v} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* Discrepancies Tab */}
        {discrepancyVars.length > 0 && (
          <TabsContent value="discrepancies" className="m-0">
            <div className="p-6 space-y-6">
              {discrepancyVars.map((v) => (
                <DiscrepancyList key={v.id || v.variable_name} variable={v} />
              ))}
            </div>
          </TabsContent>
        )}

        {/* Raw Data Tab */}
        <TabsContent value="raw" className="m-0">
          <div className="p-6">
            <p className="text-xs text-muted-foreground mb-3">
              Complete API response payload for integration and debugging purposes.
            </p>
            <pre className="text-xs font-mono text-foreground bg-muted/50 rounded-lg border border-border p-4 overflow-auto max-h-[600px] whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="m-0">
          <div className="p-6">
            {auditTrail.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No audit log entries available.
              </p>
            ) : (
              <div className="space-y-0">
                {auditTrail.map((entry, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-4 py-3",
                      i < auditTrail.length - 1 && "border-b border-border"
                    )}
                  >
                    <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-primary shrink-0 min-w-[60px]">
                      {entry.actor}
                    </span>
                    <span className="text-xs text-foreground">
                      {entry.action}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
