import React, { useState, useEffect } from "react";
import {
  Sparkles,
  LayoutDashboard,
  Building2,
  FileSpreadsheet,
  Zap,
  ArrowRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { api } from "../services/api";
import Button from "./ui/Button";

interface OnboardingModalProps {
  onComplete?: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const profile = await api.getUserProfile();
      if (!profile.settings?.onboarding_completed) {
        setOpen(true);
      }
    } catch {
      //
    }
  };

  const handleFinish = async () => {
    try {
      setSaving(true);
      await api.updateUserSettings({ onboarding_completed: true });
      setOpen(false);
      if (onComplete) onComplete();
    } catch {
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const tourSteps = [
    {
      step: 1,
      title: "Welcome to MSME Risk AI",
      badge: "Platform Overview",
      icon: Sparkles,
      desc: "Your enterprise-grade AI decision support workspace for assessing Micro, Small, and Medium Enterprise credit default probabilities with high accuracy and explainability.",
    },
    {
      step: 2,
      title: "Executive Risk Analytics",
      badge: "Dashboard Workspace",
      icon: LayoutDashboard,
      desc: "Monitor portfolio health with customizable date ranges (7D, 30D, 90D), velocity trend charts, industry comparisons, and risk distribution donuts.",
    },
    {
      step: 3,
      title: "Borrower Entity Management",
      badge: "Business Profiles",
      icon: Building2,
      desc: "Create dedicated business profiles, track loan assessment histories over time, and compare changes across multiple evaluation cycles.",
    },
    {
      step: 4,
      title: "Document Intelligence & OCR",
      badge: "Financial Statements",
      icon: Zap,
      desc: "Securely upload bank statements and income sheets with automated OCR extraction. Always preview and confirm values before calculating predictions.",
    },
    {
      step: 5,
      title: "Explainable Risk Memos",
      badge: "Decision Memos",
      icon: FileSpreadsheet,
      desc: "Inspect top decision factors, simulate what-if scenarios, generate print-ready PDF credit reports, and export compliance data.",
    },
  ];

  const current = tourSteps[step - 1];
  const CurrentIcon = current.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={handleFinish}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg rounded-3xl bg-[#0d1a2f] border border-[#23436d] p-6 sm:p-8 shadow-2xl shadow-black/95 z-10 animate-in zoom-in-95 duration-200">
        <button
          onClick={handleFinish}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress Pill */}
        <div className="flex items-center gap-2 mb-6">
          {tourSteps.map((s) => (
            <div
              key={s.step}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                s.step <= step ? "bg-gradient-to-r from-cyan-400 to-blue-500" : "bg-[#162740]"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center text-center my-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-5 shadow-xl shadow-cyan-950/40">
            <CurrentIcon className="w-8 h-8" />
          </div>

          <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-1">
            {current.badge} • Step 0{step} of 05
          </span>

          <h3 className="text-xl sm:text-2xl font-bold text-white font-['Space_Grotesk'] mb-3">
            {current.title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mb-6">
            {current.desc}
          </p>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-[#182d4d] gap-3">
          <button
            type="button"
            onClick={handleFinish}
            className="text-xs text-slate-400 hover:text-white font-medium"
          >
            Skip Tour
          </button>

          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((prev) => prev - 1)}
              >
                Back
              </Button>
            )}

            {step < 5 ? (
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRight className="w-4 h-4" />}
                iconPosition="right"
                onClick={() => setStep((prev) => prev + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                icon={<CheckCircle2 className="w-4 h-4" />}
                iconPosition="right"
                onClick={handleFinish}
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
