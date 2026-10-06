import React, { useState } from "react";
import Header from "../components/Header";
import SEO from "../components/SEO";
import { Mail, MessageSquare, Building2, ShieldCheck, CheckCircle2, Send } from "lucide-react";
import Button from "../components/ui/Button";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    role: "Lender / Underwriter",
    message: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, would trigger a secure contact API or webhook
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col selection:bg-cyan-500/20">
      <SEO
        title="Contact Us | MSME Risk AI"
        description="Get in touch with the MSME Risk AI team for institutional inquiries, pilot onboarding, enterprise integrations, or security disclosures."
        canonical="https://msme-risk-ai.vercel.app/contact"
      />
      <Header />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-semibold mb-4">
            <Mail className="w-4 h-4" /> Institutional Partnerships & Support
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Connect With Our Team
          </h1>
          <p className="text-slate-300 mt-4 text-base sm:text-lg">
            Whether you are evaluating our risk scoring engine for your lending portfolio or require technical integration support, we are here to assist.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-16">
          {/* Contact Details Card */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" /> Enterprise Inquiries
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                Partner with us for customized credit policy tuning, batch scoring APIs, and loan origination system (LOS) integrations.
              </p>
              <div className="text-xs text-slate-400 space-y-2">
                <p><span className="text-white font-medium">Email:</span> partnerships@msmeriskai.com</p>
                <p><span className="text-white font-medium">Response Time:</span> Within 24 business hours</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#091426] border border-[#182c47]">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" /> Responsible Disclosure
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                For vulnerability reporting, compliance documentation, or SOC2 questionnaires:
              </p>
              <div className="text-xs text-slate-400 space-y-2">
                <p><span className="text-white font-medium">Security Email:</span> security@msmeriskai.com</p>
                <p><span className="text-white font-medium">PGP Key:</span> Available upon request</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 p-8 rounded-2xl bg-[#091426] border border-[#182c47]">
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Inquiry Received</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
                  Thank you for reaching out. A risk analytics specialist will review your inquiry and follow up within one business day.
                </p>
                <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-cyan-400" /> Send an Inquiry
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Jane Doe"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#060d19] border border-[#1d3354] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jane@institution.com"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#060d19] border border-[#1d3354] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Organization / Institution
                    </label>
                    <input
                      type="text"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      placeholder="Bank, NBFC, or Fintech"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#060d19] border border-[#1d3354] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Primary Role
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#060d19] border border-[#1d3354] text-white text-sm focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Lender / Underwriter">Credit Officer / Underwriter</option>
                      <option value="Risk Executive">Head of Risk / CRO</option>
                      <option value="Fintech Developer">Fintech / Product Engineer</option>
                      <option value="MSME Founder">MSME Business Owner</option>
                      <option value="Researcher / Other">Academic / Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Message / Description *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your lending volume, requirements, or integration timelines..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#060d19] border border-[#1d3354] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <Button variant="primary" size="md" type="submit" className="w-full sm:w-auto">
                  <Send className="w-4 h-4 mr-2 inline" /> Submit Inquiry
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-8 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. Institutional Credit Decision Support.</p>
      </footer>
    </div>
  );
}
