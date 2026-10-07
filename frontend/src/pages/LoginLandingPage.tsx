import { useNavigate, Link } from "react-router-dom";
import {
  Building2,
  ClipboardCheck,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Lock,
} from "lucide-react";
import Brand from "../components/Brand";

export default function LoginLandingPage() {
  const navigate = useNavigate();

  const loginPortals = [
    {
      id: "user",
      title: "MSME User Login",
      badge: "For business owners and MSMEs",
      description: "Submit your business information, financial data and documents.",
      path: "/login/user",
      icon: Building2,
      accentColor: "from-cyan-500/20 to-blue-600/10",
      borderColor: "border-cyan-500/30 hover:border-cyan-400/60",
      glowColor: "group-hover:shadow-cyan-500/10",
      iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      buttonVariant: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/40",
      buttonText: "Log in as MSME User",
    },
    {
      id: "analyst",
      title: "Analyst Login",
      badge: "For credit risk analysts",
      description: "Review MSME applications, verify documents and analyze AI risk insights.",
      path: "/login/analyst",
      icon: ClipboardCheck,
      accentColor: "from-indigo-500/20 to-purple-600/10",
      borderColor: "border-indigo-500/30 hover:border-indigo-400/60",
      glowColor: "group-hover:shadow-indigo-500/10",
      iconBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      buttonVariant: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40",
      buttonText: "Log in as Analyst",
    },
    {
      id: "admin",
      title: "Admin Login",
      badge: "For system administrators",
      description: "Manage users, system configuration and model monitoring.",
      path: "/login/admin",
      icon: ShieldAlert,
      accentColor: "from-purple-500/20 to-pink-600/10",
      borderColor: "border-purple-500/30 hover:border-purple-400/60",
      glowColor: "group-hover:shadow-purple-500/10",
      iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      buttonVariant: "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/40",
      buttonText: "Log in as Administrator",
    },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#040812] text-slate-100 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-[#112038]">
        <Brand />
        <div className="flex items-center gap-3">
          <Link
            to="/register"
            className="text-xs sm:text-sm text-slate-300 hover:text-white px-3.5 py-1.5 rounded-lg border border-slate-700/60 hover:border-slate-600 transition-colors"
          >
            Create MSME Account
          </Link>
          <Link
            to="/"
            className="text-xs sm:text-sm text-slate-400 hover:text-cyan-400 transition-colors hidden sm:inline-block"
          >
            Back to Home →
          </Link>
        </div>
      </header>

      {/* Main Authentication Landing Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12 sm:py-16 flex-1 flex flex-col justify-center items-center text-center">
        {/* Badge & Title */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-4 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Unified Enterprise Authentication</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-['Space_Grotesk'] mb-3">
          MSME Risk AI
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl font-light leading-relaxed mb-12">
          AI-Assisted Credit Risk Assessment. Select your authorized portal to access underwriting intelligence.
        </p>

        {/* 3 Premium Login Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {loginPortals.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.id}
                onClick={() => navigate(portal.path)}
                className={`group relative flex flex-col justify-between p-7 rounded-2xl bg-[#091322]/90 backdrop-blur-sm border ${portal.borderColor} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${portal.glowColor} cursor-pointer text-left`}
              >
                {/* Gradient background sheen */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${portal.accentColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                />

                <div className="relative z-10 space-y-4">
                  {/* Icon & Badge */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${portal.iconBg} transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/60">
                      {portal.id === "user" ? "Borrower" : portal.id === "analyst" ? "Underwriter" : "Admin"}
                    </span>
                  </div>

                  {/* Title & Audience */}
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight group-hover:text-cyan-300 transition-colors">
                      {portal.title}
                    </h2>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      {portal.badge}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300/80 leading-relaxed min-h-[40px]">
                    "{portal.description}"
                  </p>
                </div>

                {/* Card Action Button */}
                <div className="relative z-10 pt-6 mt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(portal.path);
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${portal.buttonVariant}`}
                  >
                    <span>{portal.buttonText}</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security & Role Integrity Note */}
        <div className="mt-12 max-w-xl text-center space-y-2 text-xs text-slate-400">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Strict Role-Based Access Control Enforced</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Accounts are automatically validated against institutional records upon login. Access to analyst and admin portals requires verified role authorization.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-[#112038] bg-[#03060f]/80 py-6 px-6 text-center text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-center gap-2 text-slate-300 font-semibold text-xs">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>AI-Assisted Credit Risk Assessment</span>
        </div>
        <p className="max-w-2xl mx-auto text-[11px] leading-relaxed">
          AI-generated risk insights are decision-support information and do not autonomously approve or reject loans. Final credit authority resides with accredited underwriting institutions.
        </p>
        <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-slate-400">
          <Link to="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-slate-300">Terms of Service</Link>
          <span>•</span>
          <Link to="/security" className="hover:text-slate-300">Security Architecture</Link>
        </div>
      </footer>
    </div>
  );
}
