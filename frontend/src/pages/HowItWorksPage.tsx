import Header from "../components/Header";
import SEO from "../components/SEO";
import { ArrowRight, Building, Cpu, SlidersHorizontal, UserCheck } from "lucide-react";
import Button from "../components/ui/Button";
import { useNavigate } from "react-router-dom";

export default function HowItWorksPage() {
  const navigate = useNavigate();

  const steps = [
    {
      num: "01",
      icon: <Building className="w-6 h-6 text-cyan-400" />,
      title: "Submit Business & Financial Indicators",
      desc: "Enter company profile parameters including age, sector, employees, annual turnover, cash flow, debt burden, and operational indicators such as utility payment consistency and invoice fulfillment rates."
    },
    {
      num: "02",
      icon: <Cpu className="w-6 h-6 text-blue-400" />,
      title: "XGBoost Default Probability Computation",
      desc: "The calibrated ML pipeline normalizes input features and evaluates credit default risk. It calculates a 12-month default probability, determines risk classification (Low, Medium, or High), and assigns model confidence."
    },
    {
      num: "03",
      icon: <SlidersHorizontal className="w-6 h-6 text-purple-400" />,
      title: "Factor Attribution & What-If Stress Testing",
      desc: "Inspect top positive credit signals and flagged default vulnerabilities. Credit officers can run hypothetical What-If simulations to test resilience against cash flow squeezes or debt variations."
    },
    {
      num: "04",
      icon: <UserCheck className="w-6 h-6 text-emerald-400" />,
      title: "Analyst Governance & Human Lending Decision",
      desc: "Authorized credit underwriters review assessment dossiers, attach formal underwriting notes, request supplemental documentation, and record final decisions (Approved, Rejected, or Needs Info)."
    }
  ];

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="How It Works | MSME Risk AI"
        description="Learn how MSME Risk AI works: from business input and XGBoost evaluation to explainable SHAP factor attribution and analyst review workflow."
        canonical="https://msme-risk-ai.vercel.app/how-it-works"
      />
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
            Underwriting Workflow
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            How MSME Risk AI Works
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg">
            A 4-step workflow connecting alternative data with machine learning and human credit committee governance.
          </p>
        </div>

        <div className="space-y-8 mb-16">
          {steps.map((s, i) => (
            <div key={i} className="p-8 rounded-2xl bg-[#091426] border border-[#182c47] flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="text-4xl font-extrabold text-cyan-500/20 md:w-16 shrink-0">{s.num}</div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 shrink-0">{s.icon}</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 rounded-2xl bg-gradient-to-r from-[#0c1a2e] to-[#0a1526] border border-[#182c47] text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Experience the Workflow Firsthand</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-6">
            Get started now with an instant risk assessment and explainable credit report.
          </p>
          <Button
            variant="primary"
            size="lg"
            icon={<ArrowRight className="w-5 h-5" />}
            iconPosition="right"
            onClick={() => navigate("/register")}
          >
            Start An Assessment
          </Button>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. Workflow Governance.</p>
      </footer>
    </div>
  );
}
