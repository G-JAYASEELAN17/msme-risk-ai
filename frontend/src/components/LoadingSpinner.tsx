import { Loader2, ShieldCheck } from "lucide-react";

interface LoadingSpinnerProps {
  fullPage?: boolean;
  text?: string;
  size?: "sm" | "md" | "lg";
}

export default function LoadingSpinner({
  fullPage = false,
  text = "Loading your workspace...",
  size = "md",
}: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4 text-center p-6 animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center text-[#A78BFA] shadow-xl shadow-[#0C0A1D]/40">
          <ShieldCheck className="w-7 h-7 animate-pulse" />
        </div>
        <Loader2 className="absolute -inset-1 w-16 h-16 text-[#A78BFA]/60 animate-spin" />
      </div>
      {text && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-slate-200">{text}</p>
          <p className="text-xs text-slate-400">Verifying secure intelligence pipeline</p>
        </div>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0C0A1D] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]">
        {spinner}
      </div>
    );
  }

  return spinner;
}
