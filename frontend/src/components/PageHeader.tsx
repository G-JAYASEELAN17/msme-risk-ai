import React from "react";

export interface PageHeaderProps {
  badge?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  badge,
  title,
  description,
  actions,
  children,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-[#383154]">
      <div className="flex flex-col gap-1 max-w-2xl">
        {badge && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[#A78BFA] uppercase font-mono-numeric">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
            {badge}
          </span>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white font-['Space_Grotesk']">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-400 leading-relaxed font-normal">
            {description}
          </p>
        )}
        {children}
      </div>

      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
};

export default PageHeader;
