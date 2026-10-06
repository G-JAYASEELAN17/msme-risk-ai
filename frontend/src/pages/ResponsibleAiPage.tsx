import Header from "../components/Header";
import SEO from "../components/SEO";
import { Scale, Users, AlertTriangle, ShieldCheck, HelpCircle, ArrowRight, BrainCircuit, Sliders } from "lucide-react";
import Button from "../components/ui/Button";
import { useNavigate } from "react-router-dom";

export default function ResponsibleAiPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col selection:bg-cyan-500/20">
      <SEO
        title="Responsible AI & Governance | MSME Risk AI"
        description="Our ethical principles, transparency commitments, model limitations, and human-in-the-loop safeguards in AI-assisted credit risk assessment."
        canonical="https://msme-risk-ai.vercel.app/responsible-ai"
      />
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Breadcrumb / Badge */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
            <Scale className="w-4 h-4" /> AI Ethics & Algorithmic Governance
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Responsible AI & Model Governance
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg">
            Guiding principles, transparent disclosures, and human-in-the-loop safeguards underpinning MSME Risk AI.
          </p>
        </div>

        {/* Mandatory Core Declaration Banner */}
        <div className="p-6 sm:p-8 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 text-cyan-100 mb-12 shadow-lg shadow-cyan-950/20">
          <div className="flex items-start gap-4">
            <ShieldCheck className="w-8 h-8 text-cyan-400 shrink-0 mt-1" />
            <div>
              <h2 className="text-lg font-bold text-white mb-2">Fundamental System Charter</h2>
              <p className="text-base sm:text-lg font-medium text-cyan-200 leading-relaxed italic border-l-4 border-cyan-400 pl-4 py-1 my-3 bg-cyan-950/40 rounded-r-lg">
                "This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans."
              </p>
              <p className="text-xs sm:text-sm text-cyan-300/80 mt-2">
                Every credit decision requires review and sign-off by a qualified credit analyst. Algorithmic outputs serve solely as supplementary analytical insights to enhance diligence and consistency.
              </p>
            </div>
          </div>
        </div>

        {/* Key Governance Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* 1. Human-in-the-Loop */}
          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <Users className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">1. Human-in-the-Loop Analyst Review</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Algorithms provide quantitative scoring, but experienced credit analysts understand commercial nuances, local market cycles, and qualitative borrower relationships.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Mandatory underwriting review for all intermediate or high-risk assessments</li>
              <li>Analyst overrides documented with formal rationale in append-only audit logs</li>
              <li>Dual-authorization workflows supported for enterprise lending committees</li>
            </ul>
          </div>

          {/* 2. Explainability & SHAP */}
          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <BrainCircuit className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">2. Explainable Factor Attribution</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              We prohibit opaque black-box scoring. Every prediction generates additive Shapley values (SHAP) that quantify exactly how each financial variable influenced the final risk score.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Top protective factors (reducing default probability) highlighted in green</li>
              <li>Top risk drivers (increasing default probability) clearly itemized in red</li>
              <li>Permits clear, compliant adverse action explanations for small business applicants</li>
            </ul>
          </div>

          {/* 3. Hypothetical What-If Scenarios */}
          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <Sliders className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">3. Hypothetical Simulation Safeguards</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Our What-If simulation tool models sensitivity to macro shocks, revenue fluctuations, and debt adjustments.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>What-If results are strictly mathematical stress tests and counterfactual projections</li>
              <li>Simulations do NOT represent guarantees of future business performance</li>
              <li>Simulations never alter historical financial records or official database assessments</li>
            </ul>
          </div>

          {/* 4. Model & Calibration Governance */}
          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <AlertTriangle className="w-8 h-8 text-amber-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">4. Disclosed Model & Confidence Limits</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              No machine learning model is flawless. We explicitly document model performance characteristics and limitations to prevent over-reliance.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Confidence metrics reflect probabilistic certainty and data completeness</li>
              <li>Models calibrated on historical data may exhibit lower accuracy during macro crises</li>
              <li>Ongoing drift detection alerts administrators when distribution shifts occur</li>
            </ul>
          </div>
        </div>

        {/* Detailed Disclosure Matrix */}
        <div className="p-8 rounded-2xl bg-[#091426] border border-[#182c47] mb-16">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-cyan-400" /> Model Limitations & Disclaimers
          </h2>
          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <div>
              <h4 className="text-white font-semibold mb-1">Fairness and Demographic Boundaries:</h4>
              <p className="text-slate-400 text-xs sm:text-sm">
                MSME Risk AI strictly excludes protected characteristics such as gender, race, caste, religion, or personal background from its feature sets. All predictive features are confined to verified business operations, cash flow statements, debt obligations, and commercial indicators.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-1">Data Quality & Incomplete Records:</h4>
              <p className="text-slate-400 text-xs sm:text-sm">
                The accuracy of an AI assessment depends directly on the integrity of applicant data. While Document Intelligence OCR flags discrepancies, human verification of extracted metrics is mandatory before computing formal scores.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-1">No Autonomous Lending Commitment:</h4>
              <p className="text-slate-400 text-xs sm:text-sm">
                MSME Risk AI does not issue credit sanctions, loan approvals, or binding legal commitments. Lenders maintain independent credit underwriting policies and regulatory accountability.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-[#0c1a2e] to-[#0a1526] border border-[#182c47] text-center">
          <h2 className="text-xl font-bold text-white mb-2">Review Model Architecture or Test Live Demo</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-6">
            Explore our model performance benchmarks or test the safe public demo with synthetic MSME data.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button variant="primary" size="md" onClick={() => navigate("/demo")}>
              Try Public Demo <ArrowRight className="w-4 h-4 ml-1 inline" />
            </Button>
            <Button variant="outline" size="md" onClick={() => navigate("/security")}>
              Security & Compliance
            </Button>
          </div>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. Ethical Machine Learning & Credit Risk Governance.</p>
      </footer>
    </div>
  );
}
