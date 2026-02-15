"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

type JobPhase = "idle" | "initiating" | "uploading" | "executing" | "polling" | "completed" | "failed";

interface JobStatusTrackerProps {
  phase: JobPhase;
  jobExecutionId?: string;
  statusMessage?: string;
  progress?: number;
}

const PHASES: { key: JobPhase; label: string }[] = [
  { key: "initiating", label: "Initiating Job" },
  { key: "uploading", label: "Uploading Documents" },
  { key: "executing", label: "Executing Workflow" },
  { key: "polling", label: "Processing Analysis" },
  { key: "completed", label: "Results Ready" },
];

function getPhaseIndex(phase: JobPhase): number {
  const idx = PHASES.findIndex((p) => p.key === phase);
  return idx === -1 ? -1 : idx;
}

export function JobStatusTracker({
  phase,
  jobExecutionId,
  statusMessage,
  progress,
}: JobStatusTrackerProps) {
  const currentIndex = getPhaseIndex(phase);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === "idle" || phase === "completed" || phase === "failed") {
      startRef.current = null;
      return;
    }
    if (!startRef.current) {
      startRef.current = Date.now();
    }
    const interval = setInterval(() => {
      if (startRef.current) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  if (phase === "idle") return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {phase === "failed" ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : phase === "completed" ? (
            <CheckCircle2 className="h-5 w-5 text-accent" />
          ) : (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {phase === "failed"
                ? "Execution Failed"
                : phase === "completed"
                  ? "Analysis Complete"
                  : "Running Compliance Analysis"}
            </h3>
            {jobExecutionId && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Job ID: {jobExecutionId}
              </p>
            )}
          </div>
        </div>
        {phase !== "completed" && phase !== "failed" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(elapsed)}
          </div>
        )}
      </div>

      {progress !== undefined && phase !== "completed" && phase !== "failed" && (
        <Progress value={progress} className="h-1.5 mb-4" />
      )}

      <div className="flex items-center gap-1">
        {PHASES.map((p, i) => {
          const isActive = p.key === phase;
          const isDone = currentIndex > i;
          const isFailed = phase === "failed" && isActive;

          return (
            <div key={p.key} className="flex-1 flex items-center gap-1">
              <div className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "h-1.5 w-full rounded-full transition-all",
                    isDone && "bg-accent",
                    isActive && !isFailed && "bg-primary animate-pulse",
                    isFailed && "bg-destructive",
                    !isDone && !isActive && "bg-muted"
                  )}
                />
                <div className="flex items-center gap-1">
                  {isDone ? (
                    <CheckCircle2 className="h-3 w-3 text-accent" />
                  ) : isActive && !isFailed ? (
                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  ) : isFailed ? (
                    <XCircle className="h-3 w-3 text-destructive" />
                  ) : (
                    <FileSearch className="h-3 w-3 text-muted-foreground/40" />
                  )}
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      isDone && "text-accent",
                      isActive && "text-foreground",
                      !isDone && !isActive && "text-muted-foreground/50"
                    )}
                  >
                    {p.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {statusMessage && (
        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
