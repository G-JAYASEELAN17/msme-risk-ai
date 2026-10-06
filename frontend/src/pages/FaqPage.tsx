import Header from "../components/Header";
import SEO from "../components/SEO";
import { HelpCircle } from "lucide-react";

export default function FaqPage() {
  const faqs = [
    {
      q: "What is MSME Risk AI?",
      a: "MSME Risk AI is an AI-powered credit risk decision-support platform designed for lenders, microfinance institutions, and small business owners. It computes default probabilities, categorizes risk into Low, Medium, and High tiers, isolates driving financial factors, and provides scenario stress-testing tools."
    },
    {
      q: "Does MSME Risk AI automatically approve or reject loans?",
      a: "No. The platform is strictly an AI-assisted decision-support system. It generates probabilistic assessments and explainability factors to inform human credit analysts. All final credit and underwriting decisions are made by authorized human personnel."
    },
    {
      q: "Why was XGBoost selected as the primary machine learning algorithm?",
      a: "During rigorous comparative evaluation across candidate algorithms, XGBoost achieved the highest ROC-AUC score of 0.9647, outperforming Logistic Regression (0.9571), Random Forest (0.9591), and Decision Trees (0.899). ROC-AUC was chosen as the primary selection criterion because rank-ordering default risk across positive and negative outcomes is the vital benchmark in financial risk underwriting."
    },
    {
      q: "What metrics are included in the evaluation of the model?",
      a: "On the held-out test dataset, the model achieved: ROC-AUC: 0.9647, Accuracy: 91.8%, Precision: 78.1%, Recall: 82.0%, and F1-Score: 0.800. The model is retrained periodically with cross-validation."
    },
    {
      q: "What alternative indicators does the system analyze?",
      a: "In addition to traditional turnover, cash flow, expenses, and debt obligations, MSME Risk AI evaluates monthly digital transaction velocity, utility bill payment regularity scores, invoice fulfillment timeliness, and past default records."
    },
    {
      q: "How does the What-If simulation feature work?",
      a: "The What-If simulator allows credit officers to modify hypothetical parameters—such as revenue reductions, cash flow fluctuations, or debt increases—and immediately observe projected probability shifts without altering official assessment database records."
    },
    {
      q: "How is sensitive borrower financial data secured?",
      a: "Data is protected with Google Firebase JWT authentication, Supabase PostgreSQL with encrypted connections, role-based backend authorization, private storage buckets with temporary signed URLs, and immutable compliance audit logs."
    },
    {
      q: "Can I delete my business data and uploaded documents?",
      a: "Yes. Authenticated users can delete businesses, assessments, and uploaded files directly through the application interface or by submitting a formal deletion request."
    }
  ];

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="Frequently Asked Questions | MSME Risk AI"
        description="Find answers to common questions about MSME Risk AI model selection, default prediction, explainability, security, and underwriter workflows."
        canonical="https://msme-risk-ai.vercel.app/faq"
      />
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
            Knowledge Base
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg">
            Everything you need to know about our model methodology, explainable credit scoring, and institutional data governance.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
              <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0" />
                {faq.q}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed pl-7">{faq.a}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
