import Header from "../components/Header";
import SEO from "../components/SEO";
import { Building2, Target, HeartHandshake, Award } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="About Us | MSME Risk AI"
        description="Learn about the mission behind MSME Risk AI: closing the small business credit gap through transparent, explainable machine learning and underwriter empowerment."
        canonical="https://msme-risk-ai.vercel.app/about"
      />
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
            Our Mission
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Bridging the MSME Credit Gap
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg">
            Empowering lenders with explainable AI and alternative signals to underwrite deserving small businesses with confidence.
          </p>
        </div>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          <div className="p-8 rounded-2xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan-400" /> The Problem We Solve
            </h2>
            <p>
              Micro, Small, and Medium Enterprises (MSMEs) form the backbone of global commerce, generating over 50% of employment worldwide. Yet, according to global banking data, they face an estimated $5 trillion unmet credit demand. Traditional scoring systems rely heavily on historical multi-year audited financial records and formal collateral, shutting out otherwise healthy, cash-flow-positive enterprises.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-emerald-400" /> The Explainability Principle
            </h2>
            <p>
              We reject the premise that modern AI in lending should be an uninterpretable black box. Regulatory scrutiny, fairness, and prudent risk governance require that every prediction be backed by tangible drivers. By isolating positive repayment trends and flagged balance sheet liabilities, MSME Risk AI puts credit analysts in full command of their decisions.
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" /> Human In The Loop
            </h2>
            <p>
              Our philosophy is rooted in decision support rather than automated replacement. Artificial intelligence serves to highlight patterns, simulate stress tests, and synthesize complex alternative metrics, while experienced human credit analysts retain sole responsibility for approving lending facilities.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
