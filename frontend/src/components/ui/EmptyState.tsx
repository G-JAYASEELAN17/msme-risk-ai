import React from "react";
import Button from "./Button";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  icon?: React.ReactNode | React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionText?: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  actionIcon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  actionLabel,
  onAction,
  actionIcon,
  action,
}) => {
  const renderIcon = () => {
    if (!icon) return <FolderOpen className="w-7 h-7" />;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === "function" || (typeof icon === "object" && (icon as any)?.$$typeof)) {
      const IconComp = icon as React.ComponentType<{ className?: string }>;
      return <IconComp className="w-7 h-7" />;
    }
    return <FolderOpen className="w-7 h-7" />;
  };

  const buttonText = actionText || actionLabel;

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-[#383154] bg-[#1C1933]/60">
      <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#A78BFA] flex items-center justify-center mb-4 shadow-lg shadow-[#8B5CF6]/10">
        {renderIcon()}
      </div>
      <h3 className="text-base sm:text-lg font-bold text-[#F5F3FF] font-['Space_Grotesk'] mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-[#B7B1D1] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {buttonText && onAction && (
        <Button onClick={() => void onAction()} icon={actionIcon} size="md">
          {buttonText}
        </Button>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
