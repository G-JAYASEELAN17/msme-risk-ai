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
          <label htmlFor={selectId} className="text-xs font-medium text-slate-300 flex items-center gap-1">
            {label}
            {required && <span className="text-rose-400 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            disabled={disabled}
            className={`w-full appearance-none rounded-lg bg-[#0a1424] border text-slate-100 text-sm px-3.5 py-2.5 pr-10 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              error
                ? "border-rose-500/80 focus:border-rose-400 focus:ring-1 focus:ring-rose-500/30"
                : "border-[#1e324e] hover:border-[#2d4b73] focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]/30"
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="bg-[#0a1424] text-slate-500">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#0a1424] text-slate-100 py-1">
                {opt.label}
              </option>
            ))}
            {children}
          </select>

          <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {error ? (
          <p className="flex items-center gap-1 text-xs text-rose-400 mt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-slate-400 mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
