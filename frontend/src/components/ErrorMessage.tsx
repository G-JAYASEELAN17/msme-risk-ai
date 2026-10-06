import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Button from "./ui/Button";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  title?: string;
}

export default function ErrorMessage({
  message,
  onRetry,
  title = "An error occurred",
}: ErrorMessageProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 mb-6 shadow-lg shadow-rose-950/20">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-rose-100">{title}</h4>
          <p className="text-xs text-rose-300 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          className="shrink-0 border-rose-500/40 hover:bg-rose-500/20 text-rose-200"
        >
          Try Again
        </Button>
      )}
    </div>
  );
}
