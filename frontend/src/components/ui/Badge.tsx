import React from "react";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | string;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "low" | "medium" | "high" | "info" | "neutral" | "success" | "warning" | "danger" | "primary" | "violet";
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
    info: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    primary: "bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/30",
    violet: "bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/30",
    neutral: "bg-[#252141] text-[#B7B1D1] border-[#383154]",
  };

  const dotColors = {
    low: "bg-emerald-400",
    medium: "bg-amber-400",
    high: "bg-rose-400",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    info: "bg-blue-400",
    primary: "bg-[#A78BFA]",
    violet: "bg-[#A78BFA]",
    neutral: "bg-[#B7B1D1]",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 gap-1 font-semibold tracking-wider",
    md: "text-xs px-2.5 py-0.5 gap-1.5 font-medium tracking-wide",
    lg: "text-xs px-3 py-1 gap-2 font-medium tracking-wide",
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg border uppercase font-mono-numeric select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]} ${
            pulse ? "animate-pulse" : ""
          }`}
        />
      )}
      {children}
    </span>
  );
};

export const RiskBadge: React.FC<{ riskLevel?: RiskLevel; level?: RiskLevel; size?: "sm" | "md" | "lg" }> = ({
  riskLevel,
  level: legacyLevel,
  size = "md",
}) => {
  const level = (riskLevel || legacyLevel || "").toUpperCase();
  const variantMap: Record<string, "low" | "medium" | "high"> = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
  };
  const variant = variantMap[level] || "neutral";

  return (
    <Badge variant={variant} size={size} dot>
      {level || "UNKNOWN"} RISK
    </Badge>
  );
};

export const StatusBadge: React.FC<{ status: string; size?: "sm" | "md" | "lg" }> = ({
  status,
  size = "md",
}) => {
  const s = (status || "").toLowerCase();
  const variantMap: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
    approved: "success",
    verified: "success",
    needs_info: "warning",
    rejected: "danger",
    in_review: "info",
    pending: "neutral",
  };
  const variant = variantMap[s] || "neutral";

  return (
    <Badge variant={variant} size={size} dot>
      {s.replace("_", " ")}
    </Badge>
  );
};

export default Badge;
