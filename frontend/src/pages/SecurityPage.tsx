import Header from "../components/Header";
import SEO from "../components/SEO";
import { ShieldCheck, Lock, Database, KeyRound, FileCheck, Eye, Scale } from "lucide-react";
import Button from "../components/ui/Button";
import { useNavigate } from "react-router-dom";

export default function SecurityPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col">
      <SEO
        title="Security & Compliance | MSME Risk AI"
        description="Learn about MSME Risk AI security architecture: Firebase Authentication, Supabase PostgreSQL, private storage, role-based access control, and audit logs."
        canonical="https://msme-risk-ai.vercel.app/security"
      />
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
            <ShieldCheck className="w-4 h-4" /> Enterprise Security Architecture
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Institutional-Grade Trust & Compliance
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg">
            How MSME Risk AI protects financial data, guarantees tenant isolation, and provides defensible credit risk governance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <KeyRound className="w-8 h-8 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">1. Identity & Authentication</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Authentication is managed via Google Firebase Authentication supporting enterprise Google OAuth and secure email/password flows.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Cryptographic JWT verification via Firebase Admin SDK</li>
              <li>Development test tokens strictly disabled in production via ALLOW_TEST_AUTH</li>
              <li>Automated token expiration and session refresh controls</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <Lock className="w-8 h-8 text-emerald-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">2. Role-Based Access Control (RBAC)</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Enforced at the FastAPI backend layer on every request, never relying solely on frontend client-side route hiding.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>User role: Restricted to own businesses and assessments (IDOR prevention)</li>
              <li>Analyst role: Access to portfolio review queues and review note submission</li>
              <li>Admin role: System-wide metrics, user role governance, and full audit logs</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <Database className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">3. PostgreSQL & Encrypted Transport</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Production database runs on Supabase PostgreSQL with TLS/SSL encryption in transit (sslmode=require) and connection pooling.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Alembic migrations maintain deterministic schema upgrades</li>
              <li>Strict relational foreign key constraints with cascade isolation</li>
              <li>Application startup never modifies DDL or schema automatically</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <FileCheck className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">4. Private Document Storage</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Uploaded financial statements and balance sheets are isolated by user UID in private storage buckets.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Files are never publicly indexed or accessible</li>
              <li>Short-lived signed URLs with 1-hour expiration for authorized downloads</li>
              <li>Strict MIME validation and 10 MB upload limits</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <Eye className="w-8 h-8 text-amber-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">5. Immutable Audit Trail</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Every significant assessment creation, simulation run, review status modification, and role update is recorded.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>Logs actor UID, action timestamp, IP context, and resource ID</li>
              <li>Admin searchable interface for internal compliance audits</li>
              <li>Append-only audit table prevents modification of past events</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
            <Scale className="w-8 h-8 text-rose-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">6. AI Decision-Support Safeguards</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Artificial intelligence outputs are strictly framed as decision support for human underwriters.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
              <li>No autonomous approvals or automatic binding commitments</li>
              <li>Model attribution isolates driving factors to mitigate bias</li>
              <li>Human credit officer confirmation mandatory for all final actions</li>
            </ul>
          </div>
        </div>

        <div className="p-8 rounded-2xl bg-gradient-to-r from-[#0c1a2e] to-[#0a1526] border border-[#182c47] text-center">
          <h2 className="text-xl font-bold text-white mb-2">Need a Security Review or Compliance Audit?</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-6">
            Our technical team can provide SOC2 alignment notes, architectural topology diagrams, and penetration testing summaries upon institutional request.
          </p>
          <Button variant="primary" size="md" onClick={() => navigate("/register")}>
            Create Assessment Account
          </Button>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. Enterprise Security Architecture.</p>
      </footer>
    </div>
  );
}
