import React from "react";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  ...props
}) => {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl border border-[#383154] bg-[#1C1933] p-5 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-20 my-1 rounded" />
      <Skeleton className="h-3 w-36 rounded" />
    </div>
  );
};

export const KpiCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl border border-[#383154] bg-[#1C1933] p-5 flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-20 my-0.5 rounded" />
      <Skeleton className="h-3 w-32 rounded" />
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = "h-64" }) => {
  return (
    <div className={`rounded-2xl border border-[#383154] bg-[#1C1933] p-5 flex flex-col gap-4 ${height}`}>
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-36 rounded" />
        <Skeleton className="h-6 w-20 rounded" />
      </div>
      <div className="flex-1 flex items-end gap-3 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton
              className="w-full rounded-t"
              style={{ height: `${20 + ((i * 17) % 70)}%` }}
            />
            <Skeleton className="h-2.5 w-8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const RiskScoreSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl border border-[#383154] bg-[#1C1933] p-6 flex flex-col items-center justify-center gap-4 text-center">
      <Skeleton className="w-36 h-36 rounded-full" />
      <div className="space-y-2 w-full max-w-[200px] flex flex-col items-center">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-3.5 w-36 rounded" />
      </div>
    </div>
  );
};

export const DocumentRowSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border border-[#383154] bg-[#151229] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="rounded-2xl border border-[#383154] bg-[#1C1933] overflow-hidden">
      <div className="p-4 border-b border-[#383154] flex items-center justify-between bg-[#151229]">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 py-2 border-b border-[#383154]/50 last:border-0">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-4 rounded ${c === 0 ? "w-1/3" : "flex-1"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton height="h-72" />
        </div>
        <RiskScoreSkeleton />
      </div>
      <TableSkeleton rows={4} />
    </div>
  );
};

export const AssessmentReviewSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="h-14 rounded-2xl border border-[#383154] bg-[#1C1933] px-6 flex items-center justify-between">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
          <DocumentRowSkeleton count={2} />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <RiskScoreSkeleton />
          <ChartSkeleton height="h-48" />
        </div>
        <div className="lg:col-span-3 space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
