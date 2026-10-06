import Header from "../components/Header";
import SEO from "../components/SEO";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="Terms of Service | MSME Risk AI"
        description="Review the terms and conditions for using MSME Risk AI, including decision-support disclaimers, acceptable use, and service limitations."
        canonical="https://msme-risk-ai.vercel.app/terms"
      />
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Terms of Service</h1>
        <p className="text-xs text-slate-400 mb-8">Effective Date: October 6, 2026</p>

        <div className="prose prose-invert max-w-none text-slate-300 space-y-8 text-sm leading-relaxed">
          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">1. Nature of the Service (Decision Support Disclaimer)</h2>
            <p>
              MSME Risk AI is an analytical decision-support software application designed to assist qualified credit analysts, financial underwriters, and MSME business owners in evaluating credit default probabilities. <strong>The service does NOT provide autonomous lending commitments, binding loan approvals, statutory credit rating agency scores, or regulated legal/investment advice.</strong> All final lending, financing, or credit determinations must be made by authorized human personnel.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">2. User Accounts & Responsibilities</h2>
            <p>
              Users are responsible for maintaining the confidentiality of their credentials and for all activities conducted under their account. You agree to provide accurate, non-fraudulent financial parameters and verify that you possess legitimate authorization to analyze any business entity submitted.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">3. Acceptable Use Policy</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>You may not use the platform to generate misleading or forged financial assessments.</li>
              <li>You may not attempt to reverse engineer model weights, probe system vulnerability, or bypass backend role-based access controls.</li>
              <li>You may not upload malicious, corrupted, or executable files into document storage.</li>
            </ul>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">4. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, MSME Risk AI and its operators shall not be liable for any direct, indirect, incidental, or consequential damages resulting from loan defaults, credit losses, underwriting decisions, or business insolvency arising in connection with the use of this software.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">5. Legal Notice</h2>
            <p className="text-xs text-slate-400">
              *Notice: Standard terms for cloud decision-support software. Institutional lending entities should contact legal@msmerisk.ai for tailored Master Services Agreements (MSAs).*
            </p>
          </section>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. Terms & Legal Governance.</p>
      </footer>
    </div>
  );
}
