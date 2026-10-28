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
    "inline-flex items-center justify-center font-medium transition-all duration-150 rounded-xl select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0A1D]";

  const variantStyles = {
    primary:
      "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold shadow-md shadow-[#8B5CF6]/20 active:scale-[0.98] focus-visible:ring-[#A78BFA]",
    secondary:
      "bg-[#252141] hover:bg-[#30294D] text-[#F5F3FF] border border-[#383154] hover:border-[#8B5CF6]/40 active:scale-[0.98] focus-visible:ring-[#A78BFA]",
    outline:
      "bg-transparent hover:bg-[#252141] text-[#F5F3FF] border border-[#383154] hover:border-[#8B5CF6]/50 hover:text-white active:scale-[0.98] focus-visible:ring-[#A78BFA]",
    ghost:
      "bg-transparent hover:bg-[#252141] text-[#B7B1D1] hover:text-[#F5F3FF] focus-visible:ring-[#A78BFA]",
    danger:
      "bg-[#F87171] hover:bg-rose-600 text-white font-medium shadow-sm active:scale-[0.98] focus-visible:ring-rose-400",
    success:
      "bg-[#22C55E] hover:bg-emerald-600 text-white font-medium shadow-sm active:scale-[0.98] focus-visible:ring-emerald-400",
  };

  const sizeStyles = {
    sm: "text-xs px-3 py-1.5 gap-1.5 rounded-lg",
    md: "text-xs sm:text-sm px-4 py-2 gap-2 rounded-xl",
    lg: "text-sm sm:text-base px-5 py-2.5 gap-2.5 rounded-xl font-medium",
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
          <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
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
