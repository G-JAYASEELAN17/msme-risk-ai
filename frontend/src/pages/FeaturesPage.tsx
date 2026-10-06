import Header from "../components/Header";
import SEO from "../components/SEO";
import { Zap, BrainCircuit, Layers, ShieldCheck, FileSpreadsheet, Scale, ArrowRight } from "lucide-react";
import Button from "../components/ui/Button";
import { useNavigate } from "react-router-dom";

export default function FeaturesPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Zap className="w-8 h-8 text-cyan-400" />,
      title: "Real-Time AI Default Prediction",
      desc: "Computes 12-month default probability, risk tier, and model confidence in milliseconds using an optimized XGBoost classifier trained on multi-factor MSME datasets."
    },
    {
      icon: <BrainCircuit className="w-8 h-8 text-blue-400" />,
      title: "Explainable Factor Attribution",
      desc: "Clear SHAP-based feature importance ranking. Understand exactly which financial and operational metrics drove the prediction upward or downward."
    },
    {
      icon: <Layers className="w-8 h-8 text-purple-400" />,
      title: "Interactive What-If Simulation",
      desc: "Stress-test prospective cash flow shocks, revenue swings, or debt expansions in real time without altering official database assessment records."
    },
    {
      icon: <Scale className="w-8 h-8 text-emerald-400" />,
      title: "Analyst Review & Underwriting Queue",
      desc: "Dedicated dashboard for credit committees to inspect loan portfolios, enter underwriting notes, request additional documentation, and record human decisions."
    },
    {
      icon: <FileSpreadsheet className="w-8 h-8 text-amber-400" />,
      title: "Document Storage & Structured Extraction",
      desc: "Upload financial statements with user-isolated Supabase storage, authenticated signed URLs, and structured parsing with required human verification."
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-rose-400" />,
      title: "Enterprise RBAC & Audit Trails",
      desc: "Backend-enforced permission tiers (User, Analyst, Admin) with immutable audit event logging for all assessment cycles and administrative actions."
    }
  ];

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="Features & Capabilities | MSME Risk AI"
        description="Explore the complete suite of MSME Risk AI features: XGBoost scoring, SHAP explainability, What-If simulation, analyst review workflow, and secure document storage."
        canonical="https://msme-risk-ai.vercel.app/features"
      />
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
            Platform Capabilities
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Comprehensive Credit Risk Intelligence
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg">
            Purpose-built tools designed to accelerate MSME underwriting while preserving complete auditability and human oversight.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((f, i) => (
            <div key={i} className="p-6 rounded-2xl bg-[#091426] border border-[#182c47] hover:border-cyan-500/40 transition-all flex flex-col justify-between">
              <div>
                <div className="p-3 w-fit rounded-xl bg-slate-800/80 border border-slate-700 mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-gradient-to-r from-[#0c1a2e] to-[#0a1526] border border-[#182c47] text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Assess Your First MSME Portfolio?</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-6">
            Create an account in 30 seconds and experience explainable credit risk modeling.
          </p>
          <Button
            variant="primary"
            size="lg"
            icon={<ArrowRight className="w-5 h-5" />}
            iconPosition="right"
            onClick={() => navigate("/register")}
          >
            Get Started
          </Button>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
