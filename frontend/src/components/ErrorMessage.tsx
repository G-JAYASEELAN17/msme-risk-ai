import React from "react";
import { AlertTriangle, RefreshCw, ShieldAlert, LogIn, HelpCircle, ServerCrash, Clock } from "lucide-react";
import Button from "./ui/Button";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  title?: string;
  statusCode?: number;
}

export default function ErrorMessage({
  message,
  onRetry,
  title,
  statusCode,
}: ErrorMessageProps) {
  // Sanitize message: never expose raw stack traces
  const cleanMessage = (message || "An unexpected error occurred.")
    .split("\n")[0]
    .replace(/at\s+[\w.<>/\\:-]+/g, "")
    .trim();

  const isTimeout = /timed out|timeout|network\s*error|connection/i.test(cleanMessage) || statusCode === 408 || statusCode === 504;
  const is401 = statusCode === 401 || /401|unauthorized|session expired/i.test(cleanMessage);
  const is403 = statusCode === 403 || /403|access denied|forbidden|permission/i.test(cleanMessage);
  const is404 = statusCode === 404 || /404|not found/i.test(cleanMessage);
  const is500 = statusCode === 500 || /500|internal server error|traceback/i.test(cleanMessage);

  let displayTitle = title;
  let displayMessage = cleanMessage;
  let Icon = AlertTriangle;
  let iconColor = "text-rose-400 bg-rose-500/20";
  let borderColor = "border-rose-500/30";
  let bgColor = "bg-rose-950/40";

  if (!title) {
    if (is401) {
      displayTitle = "Session Expired";
      displayMessage = "Your authentication session has expired. Please sign in again.";
      Icon = LogIn;
      iconColor = "text-amber-400 bg-amber-500/20";
      borderColor = "border-amber-500/30";
      bgColor = "bg-amber-950/30";
    } else if (is403) {
      displayTitle = "Access Denied";
      displayMessage = "You do not have the required permissions to access this resource.";
      Icon = ShieldAlert;
      iconColor = "text-rose-400 bg-rose-500/20";
    } else if (is404) {
      displayTitle = "Resource Not Found";
      displayMessage = "The requested information could not be located or may have been deleted.";
      Icon = HelpCircle;
      iconColor = "text-[#A78BFA] bg-[#8B5CF6]/20";
      borderColor = "border-[#8B5CF6]/30";
      bgColor = "bg-[#8B5CF6]/15";
    } else if (isTimeout) {
      displayTitle = "Request Timed Out";
      displayMessage = "The server took too long to respond. Please check your connection and retry.";
      Icon = Clock;
      iconColor = "text-amber-400 bg-amber-500/20";
      borderColor = "border-amber-500/30";
      bgColor = "bg-amber-950/30";
    } else if (is500) {
      displayTitle = "Temporary Server Error";
      displayMessage = "We are experiencing a temporary system issue. Please try again shortly.";
      Icon = ServerCrash;
    } else {
      displayTitle = "An Error Occurred";
    }
  }

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl ${bgColor} border ${borderColor} text-slate-200 mb-6 shadow-lg shadow-black/40`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconColor} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-semibold text-white">{displayTitle}</h4>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{displayMessage}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          className="shrink-0 border-slate-700 hover:bg-slate-800 text-slate-200"
        >
          Try Again
        </Button>
      )}
      {is401 && !onRetry && (
        <a
          href="/login"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold transition"
        >
          Sign In
        </a>
      )}
    </div>
  );
}
