import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { CardSkeleton } from "./ui/Skeleton";

export interface StatCardProps {
  label?: string;
  title?: string;
  value: string | number;
  change?: string;
  isNegative?: boolean;
  neutral?: boolean;
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  color?: string;
  subtitle?: string;
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  title,
  value,
  change,
  isNegative,
  neutral = false,
  icon,
  subtitle,
  loading = false,
}) => {
  if (loading) {
    return <CardSkeleton />;
  }

  const displayLabel = label || title || "";

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && (icon as any)?.$$typeof)) {
      const IconComp = icon as React.ComponentType<{ className?: string }>;
      return <IconComp className="w-4 h-4" />;
    }
    return null;
  };

  const renderedIcon = renderIcon();

  return (
    <div className="rounded-xl border border-[#1a2c47] bg-gradient-to-b from-[#0e1b30] to-[#0a1424] p-5 sm:p-6 shadow-lg shadow-black/20 hover:border-[#2b4870] transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {displayLabel}
        </span>
        {renderedIcon && (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
            {renderedIcon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
          {value}
        </span>
      </div>

      {(change || subtitle) && (
        <div className="flex items-center gap-1.5 text-xs">
          {change && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                neutral
                  ? "text-slate-400"
                  : isNegative
                  ? "text-rose-400"
                  : "text-emerald-400"
              }`}
            >
              {neutral ? (
                <Minus className="w-3.5 h-3.5" />
              ) : isNegative ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              {change}
            </span>
          )}
          {subtitle && <span className="text-slate-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

export default StatCard;
