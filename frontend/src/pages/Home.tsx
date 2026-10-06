import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BrainCircuit,
  LockKeyhole,
  Zap,
  CircleHelp,
  WalletCards,
  Gauge,
  BarChart3,
  FileSpreadsheet,
  Headphones,
  PlayCircle,
  Check,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Layers,
  Activity,
} from "lucide-react";
import Header from "../components/Header";
import RiskVisual from "../components/RiskVisual";
import Button from "../components/ui/Button";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Hero Copy */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0c1c33] border border-[#1c3960] text-cyan-400 text-xs font-semibold mb-6 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Next-Gen Credit Risk Underwriting</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-['Space_Grotesk'] mb-6">
                Make every MSME lending decision{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400">
                  smarter & explainable.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-xl">
                MSME Risk AI empowers credit analysts to assess default probabilities in seconds using machine learning, alternative cash-flow indicators, and audit-ready reports.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  icon={<ArrowRight className="w-5 h-5" />}
                  iconPosition="right"
                  onClick={() => navigate("/register")}
                >
                  Start Assessing Now
                </Button>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-[#233854] bg-[#0c182b] hover:bg-[#12233f] text-slate-200 text-sm font-semibold transition-all hover:border-[#38bdf8]"
                >
                  <PlayCircle className="w-4 h-4 text-cyan-400" />
                  <span>See How It Works</span>
                </a>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-4 mt-10 pt-8 border-t border-[#14233a] w-full">
                <div className="flex -space-x-2 overflow-hidden">
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#060b14] bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                    AK
                  </div>
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#060b14] bg-cyan-600 flex items-center justify-center text-[10px] font-bold text-white">
                    JM
                  </div>
                  <div className="inline-block h-8 w-8 rounded-full ring-2 ring-[#060b14] bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                    PS
                  </div>
                </div>
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-white">1,200+ Credit Officers</span> evaluating loan portfolios with confidence
                </div>
              </div>
            </div>

            {/* Right Hero Visual Card */}
            <div className="lg:col-span-5 flex justify-center">
              <RiskVisual />
            </div>
          </div>
        </section>

        {/* TRUST VALUE BAR */}
        <section className="border-y border-[#14233a] bg-[#081120]/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white uppercase">AI Risk Engine</h4>
                <p className="text-xs text-slate-400">Multi-signal machine learning</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <LockKeyhole className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white uppercase">Consent-First</h4>
                <p className="text-xs text-slate-400">Strict data privacy controls</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white uppercase">Real-Time Speed</h4>
                <p className="text-xs text-slate-400">Calculations in seconds</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <CircleHelp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white uppercase">Explainable AI</h4>
                <p className="text-xs text-slate-400">Clear factor transparency</p>
              </div>
            </div>
          </div>
        </section>

        {/* INTRO ABOUT SECTION */}
        <section id="about" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2 block">
                The Credit Intelligence Gap
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-['Space_Grotesk'] leading-tight mb-4">
                Credit decisions are only as strong as the insight behind them.
              </h2>
            </div>

            <div className="lg:col-span-7 space-y-4 text-slate-300 text-sm sm:text-base leading-relaxed">
              <p>
                Micro, Small, and Medium Enterprises (MSMEs) represent the backbone of the global economy. Yet conventional credit scoring systems frequently overlook viable businesses due to thin credit files or rigid historical metrics.
              </p>
              <p>
                <b>MSME Risk AI</b> unifies alternative cash-flow signals, vendor invoice histories, and digital transaction health into an explainable ML scoring architecture—enabling lenders to broaden financial inclusion without compromising risk standards.
              </p>
            </div>
          </div>
        </section>

        {/* CORE FEATURES GRID */}
        <section id="features" className="py-20 bg-[#08101e] border-t border-[#14233a]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2 block">
                Comprehensive Capabilities
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-['Space_Grotesk'] mb-3">
                Everything you need to underwrite with precision
              </h2>
              <p className="text-sm text-slate-400">
                A unified platform combining financial telemetry with machine learning explainability.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: BrainCircuit,
                  title: "ML Risk Scoring",
                  desc: "Calculate probability of default using predictive models trained on diverse MSME portfolios.",
                },
                {
                  icon: WalletCards,
                  title: "Alternative Data Feeds",
                  desc: "Evaluate utility payment consistency, invoice fulfilment scores, and digital volume.",
                },
                {
                  icon: Gauge,
                  title: "Intuitive Risk Tiers",
                  desc: "Instantly categorize applicants into Low, Medium, and High risk tiers with action guidance.",
                },
                {
                  icon: BarChart3,
                  title: "Portfolio Analytics",
                  desc: "Track underwriting velocity, risk distributions, and approval trends across team workspaces.",
                },
                {
                  icon: FileSpreadsheet,
                  title: "Printable Audit Reports",
                  desc: "Generate PDF-ready credit memos and download structured JSON telemetry for compliance.",
                },
                {
                  icon: Headphones,
                  title: "Explainable Signals",
                  desc: "Inspect top driving positive factors and flagged risk indicators for every decision.",
                },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="p-6 rounded-2xl bg-[#0c182c] border border-[#1b2f4c] hover:border-[#2d4d7c] transition-all duration-200 hover:-translate-y-1 shadow-lg shadow-black/20 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-5">
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4-STEP WORKFLOW */}
        <section id="how-it-works" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2 block">
              Streamlined Flow
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-['Space_Grotesk'] mb-3">
              From application to insight in 4 steps
            </h2>
            <p className="text-sm text-slate-400">
              Clear guided process engineered for risk analysts and loan officers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: "01",
                title: "Business Profile",
                desc: "Enter business industry, age, and employee headcount.",
              },
              {
                num: "02",
                title: "Financial Signals",
                desc: "Capture gross revenue, monthly cash flows, and existing debt.",
              },
              {
                num: "03",
                title: "Alternative Metrics",
                desc: "Ingest utility scores, invoice punctuality, and default counts.",
              },
              {
                num: "04",
                title: "Decision & Audit",
                desc: "Review the default probability, factor rankings, and export PDF.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="p-6 rounded-2xl bg-[#0a1526] border border-[#162947] flex flex-col justify-between"
              >
                <div>
                  <span className="text-2xl font-black text-cyan-400/80 font-['Space_Grotesk'] block mb-4">
                    {step.num}
                  </span>
                  <h4 className="text-base font-bold text-white mb-2">{step.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA BANNER */}
        <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-[#0c203d] via-[#0e274b] to-[#0a182e] border border-[#22446d] shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center lg:text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2 block">
                Get Started Today
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white font-['Space_Grotesk'] mb-3">
                Elevate your credit underwriting intelligence
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Join forward-thinking lenders and underwrite MSME loans with precision, transparency, and speed.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              icon={<ArrowRight className="w-5 h-5" />}
              iconPosition="right"
              onClick={() => navigate("/register")}
              className="shrink-0"
            >
              Create Free Workspace
            </Button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#14233a] bg-[#050912] py-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">MSME RISK AI</span>
            <span>— Explainable Credit Decision Support</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#about" className="hover:text-cyan-400 transition-colors">About</a>
            <a href="#features" className="hover:text-cyan-400 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-cyan-400 transition-colors">How It Works</a>
            <button onClick={() => navigate("/login")} className="hover:text-cyan-400 transition-colors">Login</button>
          </div>

          <div>© 2026 MSME Risk AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
