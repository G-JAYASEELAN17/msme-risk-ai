import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  glass = false,
  hoverable = false,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`rounded-2xl border border-[#383154] bg-[#1C1933] text-[#F5F3FF] shadow-xl shadow-[#0C0A1D]/50 transition-all duration-150 ${
        glass ? "backdrop-blur-md bg-[#1C1933]/90" : ""
      } ${
        hoverable ? "hover:border-[#8B5CF6]/40 hover:bg-[#252141] hover:-translate-y-0.5" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`p-4 sm:p-5 border-b border-[#383154] flex flex-col gap-1 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <h3 className={`text-sm sm:text-base font-semibold tracking-tight text-[#F5F3FF] flex items-center gap-2 font-['Space_Grotesk'] ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <p className={`text-xs text-[#B7B1D1] font-normal leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`p-4 sm:p-5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className={`p-4 sm:p-5 pt-0 border-t border-[#383154] mt-4 flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
