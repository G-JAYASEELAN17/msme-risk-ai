import React, { forwardRef } from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  unit?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      unit,
      leftIcon,
      rightIcon,
      id,
      className = "",
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <div className="flex justify-between items-center text-xs font-medium text-[#F5F3FF]">
            <label htmlFor={inputId} className="flex items-center gap-1">
              {label}
              {required && <span className="text-[#F87171] font-bold">*</span>}
            </label>
            {unit && <span className="text-[11px] text-[#B7B1D1] font-normal">{unit}</span>}
          </div>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[#B7B1D1] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={`w-full rounded-xl bg-[#151229] border text-[#F5F3FF] placeholder:text-[#B7B1D1]/50 text-sm px-3.5 py-2.5 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-10" : ""
            } ${rightIcon ? "pr-10" : ""} ${
              error
                ? "border-[#F87171] focus:border-[#F87171] focus:ring-1 focus:ring-[#F87171]/30"
                : "border-[#383154] hover:border-[#49406B] focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#A78BFA]/30"
            } ${className}`}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 text-[#B7B1D1] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p className="flex items-center gap-1 text-xs text-[#F87171] mt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-[#B7B1D1] mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
