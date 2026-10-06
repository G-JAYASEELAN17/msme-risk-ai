import { ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BrandProps {
  collapsed?: boolean;
  className?: string;
}

export default function Brand({ collapsed = false, className = "" }: BrandProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/")}
      className={`group flex items-center gap-3 text-left transition-all duration-200 focus:outline-none ${className}`}
      aria-label="MSME Risk AI Home"
    >
      <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-0.5 shadow-md shadow-cyan-500/20 group-hover:shadow-cyan-400/40 transition-all duration-300">
        <div className="w-full h-full bg-[#091427] rounded-[10px] flex items-center justify-center text-cyan-400 group-hover:text-white transition-colors">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#070d18]" />
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1 font-bold text-base tracking-tight text-white font-['Space_Grotesk']">
            <span>MSME</span>
            <span className="text-cyan-400">RISK AI</span>
          </div>
          <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">
            Credit Intelligence
          </span>
        </div>
      )}
    </button>
  );
}
