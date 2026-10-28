import { Shield } from "lucide-react";
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
      className={`group flex items-center gap-2.5 text-left transition-all duration-150 focus:outline-none ${className}`}
      aria-label="MSME Risk AI Home"
    >
      <div className="relative w-8 h-8 rounded-xl bg-[#252141] border border-[#383154] flex items-center justify-center text-[#A78BFA] group-hover:border-[#8B5CF6]/60 group-hover:text-[#F5F3FF] transition-colors shadow-sm">
        <Shield className="w-4 h-4 text-[#8B5CF6]" />
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#8B5CF6] ring-2 ring-[#0C0A1D]" />
      </div>

      {!collapsed && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1 font-semibold text-sm tracking-tight text-[#F5F3FF] font-['Space_Grotesk']">
            <span>MSME</span>
            <span className="text-[#8B5CF6] font-bold">RISK AI</span>
          </div>
          <span className="text-[10px] font-medium text-[#B7B1D1] tracking-wider uppercase font-mono-numeric">
            Credit Intelligence
          </span>
        </div>
      )}
    </button>
  );
}
