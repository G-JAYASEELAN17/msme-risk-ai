import Header from "../components/Header";
import SEO from "../components/SEO";
import { AlertCircle, ArrowLeft, Home, Compass } from "lucide-react";
import Button from "../components/ui/Button";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#060b14] text-slate-100 flex flex-col selection:bg-cyan-500/20">
      <SEO
        title="404 — Page Not Found | MSME Risk AI"
        description="The page you requested could not be found. Explore MSME Risk AI features, public demo, or return to homepage."
        noindex={true}
      />
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-center mx-auto mb-6 text-cyan-400">
            <AlertCircle className="w-10 h-10" />
          </div>
          <span className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-semibold">
            Error 404
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed mb-8">
            The resource you requested may have been moved, renamed, or is restricted. Please check the URL or return to safety.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="primary" size="md" onClick={() => navigate("/")} className="w-full sm:w-auto">
              <Home className="w-4 h-4 mr-1.5 inline" /> Back to Home
            </Button>
            <Button variant="outline" size="md" onClick={() => navigate("/demo")} className="w-full sm:w-auto">
              <Compass className="w-4 h-4 mr-1.5 inline" /> Interactive Demo
            </Button>
          </div>
        </div>
      </main>

      <footer className="bg-[#040810] border-t border-[#101c2e] py-6 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} MSME Risk AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
