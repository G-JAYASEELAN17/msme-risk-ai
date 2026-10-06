import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  LockKeyhole,
  Zap,
  PlayCircle,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Layers,
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Database,
  Building2,
  PieChart,
  Scale,
  FileText,
  Sliders,
  Users,
} from "lucide-react";
import Header from "../components/Header";
import RiskVisual from "../components/RiskVisual";
import Button from "../components/ui/Button";
import SEO from "../components/SEO";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="AI-Assisted MSME Credit Risk Assessment | MSME Risk AI"
        description="Analyze business and financial data, understand credit risk, and support faster analyst-led lending decisions with explainable AI."
        canonical="https://msme-risk-ai.vercel.app/"
      />

      <Header />

      <main className="flex-1">
        {/* SECTION 1: HERO */}
        <section className="relative overflow-hidden py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0c1c33] border border-[#1c3960] text-cyan-400 text-xs font-semibold mb-6 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Next-Gen MSME Underwriting Decision Support</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6">
                AI-Assisted MSME{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400">
                  Credit Risk Assessment
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-xl">
                Analyze business and financial data, understand credit risk, and support faster analyst-led lending decisions with explainable AI.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<ArrowRight className="w-5 h-5" />}
                  iconPosition="right"
                  onClick={() => navigate("/assessment")}
                >
                  Start Risk Assessment
                </Button>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-[#233854] bg-[#0c182b] hover:bg-[#12233f] text-slate-200 text-sm font-semibold transition-all hover:border-[#38bdf8]"
                >
                  <PlayCircle className="w-4 h-4 text-cyan-400" />
                  <span>Explore How It Works</span>
                </a>
              </div>

              <div className="flex items-center gap-4 mt-10 pt-8 border-t border-[#14233a] w-full">
                <div className="flex -space-x-2 overflow-hidden">
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#060b14] bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">AK</div>
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#060b14] bg-cyan-600 flex items-center justify-center text-[10px] font-bold text-white">JM</div>
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#060b14] bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">PS</div>
                </div>
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-white">1,200+ Credit Analysts</span> evaluating MSME loan portfolios with explainable precision
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex justify-center">
              <RiskVisual />
            </div>
          </div>
        </section>

        {/* SECTION 2: THE PROBLEM */}
        <section className="py-16 bg-[#08101e] border-y border-[#14233a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-2">The Traditional Lending Challenge</h2>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                MSMEs Face Massive Credit Gaps Due to Outdated Underwriting
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl bg-[#0b162a] border border-[#1b3152] hover:border-rose-500/40 transition-all">
                <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Thin Credit Files</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Millions of viable micro and small enterprises lack multi-year audited financial records or formal credit bureau history, causing automatic rejections.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-[#0b162a] border border-[#1b3152] hover:border-amber-500/40 transition-all">
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Slow Manual Underwriting</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Traditional manual spread analysis takes 2–4 weeks per application, running high operational overhead and leading to lost borrowers.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-[#0b162a] border border-[#1b3152] hover:border-purple-500/40 transition-all">
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Black-Box ML Mistrust</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Generic algorithms output unverified scores without explainability, exposing lenders to regulatory scrutiny and bias without underwriter oversight.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: HOW IT WORKS */}
        <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">Underwriting Architecture</h2>
            <p className="text-3xl font-extrabold text-white">How To Assess An MSME In 4 Steps</p>
            <p className="text-slate-300 mt-3 text-sm">
              From enterprise telemetry to credit committee decisioning, our automated workflow bridges alternative signals with institutional governance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "Enter Financials & Telemetry",
                desc: "Submit annual turnover, cash flow, debt burden, and alternative payment indicators via wizard or OCR."
              },
              {
                step: "02",
                title: "Run AI Inference Engine",
                desc: "XGBoost v1.1.0 processes 11 key features to calculate default probability and a normalized 0–100 risk score."
              },
              {
                step: "03",
                title: "Inspect Explainability",
                desc: "Examine SHAP factor attribution across 7 analytical categories and stress-test What-If scenarios."
              },
              {
                step: "04",
                title: "Analyst Decisioning",
                desc: "Credit committee reviews comprehensive audit reports and records official decisions with review notes."
              }
            ].map((s, idx) => (
              <div key={idx} className="relative p-6 rounded-2xl bg-[#0c182b] border border-[#182c47] flex flex-col justify-between">
                <div>
                  <div className="text-3xl font-black text-cyan-500/20 mb-3">{s.step}</div>
                  <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: AI RISK ASSESSMENT */}
        <section className="py-20 bg-[#070e1c] border-y border-[#14233a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
                  <PieChart className="w-3.5 h-3.5" /> High Precision Discrimination
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-6">
                  Calibrated Default Probabilities & Normalized Risk Scores
                </h2>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Rather than an ambiguous numerical credit bureau score, MSME Risk AI delivers an actuarially calibrated 12-month default probability categorized into distinct operational risk bands:
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-300">LOW RISK (Score 0–24, Prob &lt; 25%):</span>
                      <p className="text-sm text-slate-300">Strong debt-to-revenue ratio, positive net operational cash flow, and clean payment trajectory.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded bg-amber-500/20 text-amber-400 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-amber-300">MEDIUM RISK (Score 25–55, Prob 25% – 55%):</span>
                      <p className="text-sm text-slate-300">Moderate leverage requiring collateral or covenant consideration by credit officers.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="p-1 rounded bg-rose-500/20 text-rose-400 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-rose-300">HIGH RISK (Score 56–100, Prob &gt; 55%):</span>
                      <p className="text-sm text-slate-300">Negative cash flow buffers or prior default history; flagged for in-depth analyst audit.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="bg-[#0b162a] border border-[#1b3152] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Live Model Output Sample</span>
                  <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono">XGBoost v1.1.0</span>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-[#070e1c] border border-slate-800">
                    <span className="text-sm text-slate-300">Normalized Risk Score:</span>
                    <span className="text-xl font-extrabold text-cyan-400 font-mono">18 / 100</span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-[#070e1c] border border-slate-800">
                    <span className="text-sm text-slate-300">Default Probability:</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">4.2%</span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-[#070e1c] border border-slate-800">
                    <span className="text-sm text-slate-300">Calculated Risk Tier:</span>
                    <span className="text-xs font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30">LOW</span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-[#070e1c] border border-slate-800">
                    <span className="text-sm text-slate-300">Model Confidence Indicator:</span>
                    <span className="text-sm font-semibold text-slate-200 font-mono">95.8%</span>
                  </div>
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-[#070e1c] border border-slate-800">
                    <span className="text-sm text-slate-300">Validation Metric:</span>
                    <span className="text-sm font-semibold text-purple-300 font-mono">ROC-AUC 0.9647</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: DOCUMENT INTELLIGENCE */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-[#0c182b] border border-[#1b3152] rounded-2xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <span className="text-xs uppercase text-slate-400 font-semibold">OCR Data Extraction Pipeline</span>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">Verified Extraction</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#081220] rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300">Extracted Annual Revenue</span>
                  <span className="font-mono font-bold text-white">$2,400,000 (Confidence: 94%)</span>
                </div>
                <div className="p-3 bg-[#081220] rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300">Extracted Operating Expenses</span>
                  <span className="font-mono font-bold text-white">$90,000 / mo (Confidence: 91%)</span>
                </div>
                <div className="p-3 bg-[#081220] rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300">Total Liabilities Identified</span>
                  <span className="font-mono font-bold text-white">$210,000 (Confidence: 89%)</span>
                </div>
                <div className="p-3 bg-[#081220] rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300">Borrower Data Verification</span>
                  <span className="font-semibold text-emerald-400">✓ Manually Confirmed</span>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800 text-blue-300 text-xs font-semibold mb-4">
                <FileText className="w-3.5 h-3.5" /> Automated Optical Intelligence
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-6">
                Document Intelligence & Financial Data Extraction
              </h2>
              <p className="text-slate-300 leading-relaxed mb-6">
                Upload balance sheets, profit &amp; loss statements, GST invoices, or tax filings. Our modular OCR provider pipeline parses complex unstructured documents into verified numerical features.
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Automated confidence scoring on every extracted metric.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Human-in-the-loop verification drawer ensures accuracy before model inference.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Private tenant storage encrypted with temporary signed download URLs.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 6: EXPLAINABLE AI */}
        <section className="py-20 bg-[#070e1c] border-y border-[#14233a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">Explainable AI Architecture</h2>
              <p className="text-3xl font-extrabold text-white">SHAP Factor Attribution Across 7 Dimensions</p>
              <p className="text-slate-300 mt-4 text-sm sm:text-base">
                Never accept an unexplained black-box output. Our explainability layer isolates specific drivers that pushed the assessment score up or down across standardized analytical dimensions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 rounded-2xl bg-[#091426] border border-emerald-900/30">
                <h3 className="text-base font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Top Positive Factors
                </h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><b>Financial Strength:</b> Low debt leverage relative to revenue reduces default risk.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><b>Cash Flow:</b> Robust monthly operating cash flow buffer covers routine expenses.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><b>Payment Behaviour:</b> Consistent utility and invoice settlement scores above 85.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span><b>Alternative Signals:</b> Unblemished credit history with zero previous defaults.</span>
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-2xl bg-[#091426] border border-rose-900/30">
                <h3 className="text-base font-bold text-rose-400 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Top Negative Factors
                </h3>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">•</span>
                    <span><b>Debt Burden:</b> Elevated total liabilities exceeding 40% of annual turnover.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">•</span>
                    <span><b>Cash Flow:</b> Operating expenditure consuming &gt; 80% of incoming receivables.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">•</span>
                    <span><b>Transaction Behaviour:</b> Sparse digital transaction volume indicating liquidity compression.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">•</span>
                    <span><b>Revenue Stability:</b> Early stage enterprise with less than 2 years of trading records.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7: ANALYST REVIEW WORKFLOW */}
        <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">Human In The Loop</h2>
            <p className="text-3xl font-extrabold text-white">
              AI As Decision Support — Never Autonomous Authority
            </p>
            <p className="text-slate-300 mt-4 text-base">
              MSME Risk AI strictly adheres to the principle that AI informs underwriting while experienced credit analysts make final lending determinations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: "01", title: "AI Assessment", desc: "Feature computation & default probability estimation" },
              { step: "02", title: "Risk Tiering", desc: "Categorization into Low, Medium, or High risk bands" },
              { step: "03", title: "Explainability", desc: "SHAP factor attribution across 7 analytical categories" },
              { step: "04", title: "Analyst Review", desc: "Credit officer inspection, underwriting notes, and document review" },
              { step: "05", title: "Committee Sign-Off", desc: "Official human authorization: Approved, Rejected, or Needs Info" }
            ].map((item, idx) => (
              <div key={idx} className="p-5 rounded-xl bg-[#0b162a] border border-[#172c47] text-center flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 text-xs font-bold flex items-center justify-center mb-3 font-mono">
                  {item.step}
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 8: WHAT-IF SIMULATION */}
        <section className="py-20 bg-[#070e1c] border-y border-[#14233a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-800 text-purple-300 text-xs font-semibold mb-4">
                  <Sliders className="w-3.5 h-3.5" /> Counterfactual Modeling
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-6">
                  Interactive What-If Scenario Stress Testing
                </h2>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Simulate prospective adjustments before granting credit facility expansions or approving term adjustments. Modify revenue, expenses, cash flow, debt, loan amount, and tenure to inspect immediate probability shifts.
                </p>
                <div className="space-y-3 text-sm text-slate-300">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Hypothetical scenario results do not alter official recorded assessments.</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Calculates real-time Default Probability delta (+/– percentage points).</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Disclaimer: Scenario results are hypothetical and do not guarantee future outcomes.</span>
                  </p>
                </div>
              </div>

              <div className="lg:col-span-6 bg-[#0c182b] border border-[#1b3152] rounded-2xl p-6">
                <div className="text-xs uppercase text-slate-400 font-semibold mb-4">Live Counterfactual Demonstration</div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Annual Revenue Growth (+25%):</span>
                      <span className="text-cyan-400 font-semibold">$3,000,000</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-500 h-full w-4/5" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Debt Deleveraging (-$50,000):</span>
                      <span className="text-emerald-400 font-semibold">$160,000</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-3/5" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-400">Net Default Probability Impact:</span>
                    <span className="text-emerald-400 font-extrabold text-sm">-2.8 percentage points</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 9: SECURITY */}
        <section id="security" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">Enterprise Trust</h2>
            <p className="text-3xl font-extrabold text-white">Hardened Architecture & Strict Isolation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl bg-[#0c182b] border border-[#172c47]">
              <ShieldCheck className="w-8 h-8 text-cyan-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Firebase Authentication</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Secure JWT verification with Google and email providers. Tokens strictly verified by backend FastAPI dependencies with test authentication disabled in production.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-[#0c182b] border border-[#172c47]">
              <Database className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Supabase PostgreSQL</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Relational multi-tenant schemas managed via Alembic migrations, connection pooling, and strict user ownership filtering preventing IDOR vulnerabilities.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-[#0c182b] border border-[#172c47]">
              <LockKeyhole className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Private Storage & Audit</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Documents stored in private user-isolated buckets accessed only via temporary signed URLs. Every action is recorded in immutable compliance audit logs.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 10: RESPONSIBLE AI */}
        <section className="py-20 bg-[#070e1c] border-t border-[#14233a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto p-8 rounded-3xl bg-[#09152b] border border-cyan-500/30 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                <Scale className="w-6 h-6" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400">Institutional Governance</h2>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                Responsible AI & Decision-Support Commitment
              </p>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl mx-auto">
                "This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans."
              </p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mx-auto">
                All model predictions represent decision-support estimations designed to assist licensed credit underwriters. Decisions mandate human review and compliance verification.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                  onClick={() => navigate("/responsible-ai")}
                >
                  Read Full Responsible AI Disclosures
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 11: FAQ */}
        <section id="faq" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">Got Questions?</h2>
            <p className="text-3xl font-extrabold text-white">Frequently Asked Questions</p>
          </div>

          <div className="space-y-6">
            {[
              {
                q: "Does MSME Risk AI make automated lending decisions?",
                a: "No. MSME Risk AI is strictly a decision-support platform. It generates AI-assisted credit risk predictions and explainability factors to support credit analysts, underwriters, and lending committees who make the final credit decision."
              },
              {
                q: "Why was XGBoost selected over other machine learning algorithms?",
                a: "During comparative model evaluation, XGBoost achieved the highest ROC-AUC of 0.9647, superior to Logistic Regression (0.9571), Random Forest (0.9591), and Decision Trees (0.899). ROC-AUC was chosen as the primary selection metric because rank-ordering default risk across positive and negative classes is the core objective in credit underwriting."
              },
              {
                q: "How does the platform protect sensitive borrower documents?",
                a: "Documents are stored in private, authenticated cloud storage isolated by user UID. Files are never publicly accessible and can only be downloaded via short-lived temporary signed URLs or authenticated API routes."
              },
              {
                q: "Can credit officers modify or customize simulation scenarios?",
                a: "Yes. The What-If simulation tool allows underwriters to stress-test hypothetical changes in cash flow, revenue, debt, or loan tenure without changing the official assessment records."
              }
            ].map((faq, i) => (
              <div key={i} className="p-6 rounded-xl bg-[#0c182b] border border-[#172c47]">
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed pl-7">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 12: FINAL CALL TO ACTION */}
        <section className="py-20 bg-gradient-to-b from-[#091426] to-[#060b14] border-t border-[#14233a]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-6">
              Transform Your MSME Credit Risk Underwriting
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8">
              Join financial institutions and credit teams evaluating loan portfolios with transparent, explainable machine learning.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                icon={<ArrowRight className="w-5 h-5" />}
                iconPosition="right"
                onClick={() => navigate("/assessment")}
              >
                Start Risk Assessment
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/demo")}
              >
                Explore Public Demo
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* SECTION 13: FOOTER */}
      <footer className="bg-[#040810] border-t border-[#101c2e] py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-white text-sm mb-3">Product</h4>
              <ul className="space-y-2">
                <li><a href="/features" className="hover:text-cyan-400 transition-colors">Features</a></li>
                <li><a href="/how-it-works" className="hover:text-cyan-400 transition-colors">How It Works</a></li>
                <li><a href="/demo" className="hover:text-cyan-400 transition-colors">Interactive Demo</a></li>
                <li><a href="/about" className="hover:text-cyan-400 transition-colors">About Us</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-3">Security & Trust</h4>
              <ul className="space-y-2">
                <li><a href="/security" className="hover:text-cyan-400 transition-colors">Security Architecture</a></li>
                <li><a href="/responsible-ai" className="hover:text-cyan-400 transition-colors">Responsible AI</a></li>
                <li><a href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-3">Enterprise Portals</h4>
              <ul className="space-y-2">
                <li><a href="/login" className="hover:text-cyan-400 transition-colors">Analyst Sign In</a></li>
                <li><a href="/register" className="hover:text-cyan-400 transition-colors">Create Account</a></li>
                <li><a href="/dashboard" className="hover:text-cyan-400 transition-colors">Borrower Portal</a></li>
                <li><a href="/contact" className="hover:text-cyan-400 transition-colors">Contact Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-3">Compliance Disclaimer</h4>
              <p className="text-slate-400 leading-relaxed">
                MSME Risk AI provides AI-assisted credit risk predictions and explainability signals for analyst decision support. It does not constitute an autonomous lending commitment or statutory credit rating score.
              </p>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>&copy; {new Date().getFullYear()} MSME Risk AI. All rights reserved.</p>
            <p className="text-slate-400">AI-Assisted Credit Risk Assessment for MSME Lending Decisions.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
