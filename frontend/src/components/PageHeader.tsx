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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#16273f]">
      <div className="flex flex-col gap-1.5 max-w-2xl">
        {badge && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-cyan-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            {badge}
          </span>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Space_Grotesk']">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {description}
          </p>
        )}
        {children}
      </div>

      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
};

export default PageHeader;
