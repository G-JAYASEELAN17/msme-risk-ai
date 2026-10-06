import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  icon,
  leftIcon,
  rightIcon,
  iconPosition = "left",
  className = "",
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b14]";

  const variantStyles = {
    primary:
      "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20 hover:shadow-cyan-500/25 active:scale-[0.98] focus-visible:ring-cyan-400",
    secondary:
      "bg-[#13233a] hover:bg-[#1a304e] text-slate-100 border border-[#233854] hover:border-[#35527a] active:scale-[0.98] focus-visible:ring-slate-400",
    outline:
      "bg-transparent hover:bg-slate-800/40 text-slate-200 border border-[#273d5d] hover:border-[#38bdf8] hover:text-white active:scale-[0.98] focus-visible:ring-cyan-400",
    ghost:
      "bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white focus-visible:ring-slate-400",
    danger:
      "bg-red-600/90 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 active:scale-[0.98] focus-visible:ring-red-400",
    success:
      "bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] focus-visible:ring-emerald-400",
  };

  const sizeStyles = {
    sm: "text-xs px-3 py-1.5 gap-1.5",
    md: "text-sm px-4 py-2.5 gap-2",
    lg: "text-base px-6 py-3 gap-2.5 font-semibold",
  };

  const effectiveLeftIcon = leftIcon || (iconPosition === "left" ? icon : null);
  const effectiveRightIcon = rightIcon || (iconPosition === "right" ? icon : null);

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>{loadingText || children}</span>
        </>
      ) : (
        <>
          {effectiveLeftIcon && <span className="shrink-0">{effectiveLeftIcon}</span>}
          <span>{children}</span>
          {effectiveRightIcon && <span className="shrink-0">{effectiveRightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
