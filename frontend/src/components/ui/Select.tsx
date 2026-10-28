import React, { forwardRef } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";

export interface Option {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: Option[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options = [],
      placeholder,
      children,
      id,
      className = "",
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-[#F5F3FF] flex items-center gap-1">
            {label}
            {required && <span className="text-[#F87171] font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={`w-full appearance-none rounded-xl bg-[#151229] border text-[#F5F3FF] text-sm px-3.5 py-2.5 pr-10 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              error
                ? "border-[#F87171] focus:border-[#F87171] focus:ring-1 focus:ring-[#F87171]/30"
                : "border-[#383154] hover:border-[#49406B] focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#A78BFA]/30"
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="bg-[#151229] text-[#B7B1D1]">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#151229] text-[#F5F3FF] py-1.5">
                {opt.label}
              </option>
            ))}
            {children}
          </select>

          <div className="absolute right-3 text-[#B7B1D1] pointer-events-none flex items-center">
            <ChevronDown className="w-4 h-4" />
          </div>
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

Select.displayName = "Select";
export default Select;
