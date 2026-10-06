import React from "react";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | string;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "low" | "medium" | "high" | "info" | "neutral" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  size = "md",
  dot = false,
  pulse = false,
  className = "",
  ...props
}) => {
  const variantStyles = {
    low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    high: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    danger: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    info: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    neutral: "bg-slate-700/30 text-slate-300 border-slate-600/30",
  };

  const dotColors = {
    low: "bg-emerald-400",
    medium: "bg-amber-400",
    high: "bg-rose-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    info: "bg-sky-400",
    neutral: "bg-slate-400",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 gap-1 font-semibold",
    md: "text-xs px-2.5 py-1 gap-1.5 font-medium",
    lg: "text-sm px-3.5 py-1.5 gap-2 font-medium",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide uppercase ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${
            pulse ? "animate-ping" : ""
          }`}
        />
      )}
      {children}
    </span>
  );
};

export const RiskBadge: React.FC<{ riskLevel: RiskLevel; size?: "sm" | "md" | "lg" }> = ({
  riskLevel,
  size = "md",
}) => {
  const level = (riskLevel || "").toUpperCase();
  const variantMap: Record<string, "low" | "medium" | "high"> = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
  };
  const variant = variantMap[level] || "neutral";

  return (
    <Badge variant={variant} size={size} dot>
      {level} RISK
    </Badge>
  );
};

export default Badge;
