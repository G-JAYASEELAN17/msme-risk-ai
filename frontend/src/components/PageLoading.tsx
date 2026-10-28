import React from "react";
import { ShieldCheck } from "lucide-react";

interface PageLoadingProps {
  label?: string;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  label = "Loading workspace...",
}) => {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
      {/* Top progress indicator shimmer */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-[#8B5CF6]/20 overflow-hidden z-50">
        <div className="h-full bg-gradient-to-r from-[#8B5CF6] via-blue-500 to-indigo-500 w-1/3 animate-[shimmer_1.5s_infinite_linear]" />
      </div>

      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center text-[#A78BFA] shadow-lg shadow-[#0C0A1D]/30">
          <ShieldCheck className="w-6 h-6 animate-pulse" />
        </div>
      </div>
      <p className="text-xs font-medium text-slate-300 tracking-wide">{label}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">MSME Risk AI • Enterprise Credit Platform</p>
    </div>
  );
};

export default PageLoading;
