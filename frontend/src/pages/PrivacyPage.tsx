import Header from "../components/Header";
import SEO from "../components/SEO";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="Privacy Policy | MSME Risk AI"
        description="Learn what data is collected, why it is processed, how financial documents are stored, and how user rights and data deletion requests are honored."
        canonical="https://msme-risk-ai.vercel.app/privacy"
      />
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Privacy Policy</h1>
        <p className="text-xs text-slate-400 mb-8">Last Updated: October 6, 2026</p>

        <div className="prose prose-invert max-w-none text-slate-300 space-y-8 text-sm leading-relaxed">
          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">1. Overview & Commitment</h2>
            <p>
              MSME Risk AI (“we”, “our”, or “the platform”) provides credit risk evaluation and decision-support software for Micro, Small, and Medium Enterprises and authorized lending institutions. We are committed to transparency in the collection, storage, and processing of commercial financial information.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">2. What Data We Collect</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-white">Account Information:</strong> Name, business email address, Firebase authentication UID, and preferred platform settings.</li>
              <li><strong className="text-white">Business Profile Data:</strong> Legal enterprise name, operational industry, country/state location, company age, and employee headcount.</li>
              <li><strong className="text-white">Financial Indicators:</strong> Annual turnover, monthly cash flow figures, operational expenses, existing debt liabilities, and past loan default history.</li>
              <li><strong className="text-white">Alternative Operational Signals:</strong> Monthly digital transaction counts, utility bill consistency scores, and invoice fulfillment records.</li>
              <li><strong className="text-white">Uploaded Documents:</strong> Financial statements, balance sheets, and tax reports provided directly by the user.</li>
            </ul>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">3. Why We Collect This Data</h2>
            <p>
              Data is collected solely to compute calibrated MSME default probability predictions, generate explainable risk factor breakdowns, support underwriter review notes, and maintain regulatory compliance audit logs. We do not sell or monetize commercial borrower data to third-party ad networks.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">4. Document Storage & Protection</h2>
            <p>
              Uploaded financial documents are isolated within private, authenticated cloud storage buckets mapped strictly to your authenticated UID. Access requires valid Firebase Bearer tokens or time-limited signed URLs. Documents are never made publicly accessible.
            </p>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">5. User Rights & Data Deletion Requests</h2>
            <p>
              Under applicable data protection frameworks, users maintain rights regarding their personal and commercial data:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li><strong className="text-white">Right to Access:</strong> You may export all recorded assessments and generated reports at any time.</li>
              <li><strong className="text-white">Right to Rectification:</strong> You can update inaccurate business information or re-run assessments with updated financial figures.</li>
              <li><strong className="text-white">Right to Erasure (Deletion):</strong> You may delete uploaded documents and business records directly from the application interface or submit a formal deletion request to privacy@msmerisk.ai.</li>
            </ul>
          </section>

          <section className="p-6 rounded-xl bg-[#091426] border border-[#182c47]">
            <h2 className="text-lg font-bold text-white mb-3">6. Legal Review Disclaimer</h2>
            <p className="text-xs text-slate-400">
              *Notice: This policy represents standard institutional SaaS data protection practices. Specific financial jurisdictions (e.g. GDPR, FCRA, RBI MSME lending guidelines) may require additional localized contractual schedules upon commercial enterprise onboarding.*
            </p>
          </section>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. Privacy Governance.</p>
      </footer>
    </div>
  );
}
