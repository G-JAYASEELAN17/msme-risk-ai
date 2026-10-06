import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  FileText,
  ShieldCheck,
  BrainCircuit,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Sparkles,
  Info,
  Layers,
  BarChart3,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, ModelCardData, UserProfile } from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import Button from "../components/ui/Button";
import LoadingSpinner from "../components/LoadingSpinner";

export default function ModelCard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [card, setCard] = useState<ModelCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login");
        return;
      }
      try {
        const prof = await api.getUserProfile();
        setProfile(prof);
        if (prof.role.toLowerCase() !== "admin") {
          setLoading(false);
          return;
        }
        await loadModelCard();
      } catch (err: any) {
        console.error("Auth / profile loading error:", err);
        setError("Failed to verify administrative privileges.");
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadModelCard = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.getAdminModelCard();
      setCard(res);
    } catch (err: any) {
      console.error("Failed to load model card:", err);
      setError(err?.message || "Failed to load model card specification.");
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = profile?.role?.toLowerCase() === "admin";

  if (!loading && !isAdmin) {
    return (
      <div className="app-layout">
        <Sidebar active="Settings" />
        <main className="main-content space-y-6">
          <PageHeader
            badge="Administrative Zone"
            title="Model Card Specification"
            description="Restricted platform governance and model documentation module."
          />
          <Card className="max-w-xl mx-auto mt-12 p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white font-['Space_Grotesk']">
              Administrator Privileges Required
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Model cards and compliance specifications are restricted to compliance administrators.
            </p>
            <div className="pt-2">
              <Button variant="primary" onClick={() => navigate("/dashboard")}>
                Return to Dashboard
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar active="Settings" />

      <main className="main-content space-y-6">
        <PageHeader
          badge="Model Governance"
          title="Institutional Model Card"
          description="Standardized AI model card for credit risk assessment, verification lineage, evaluation metrics, and responsible AI disclosures."
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="md"
                icon={<BarChart3 className="w-4 h-4 text-cyan-400" />}
                onClick={() => navigate("/admin/model-monitoring")}
              >
                Model Monitoring
              </Button>
              <Button
                variant="outline"
                size="md"
                icon={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
                onClick={loadModelCard}
              >
                Refresh Card
              </Button>
            </div>
          }
        />

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex justify-center">
            <LoadingSpinner text="Loading model card specification and audit lineage..." />
          </div>
        ) : card ? (
          <div className="space-y-6">
            {/* Responsible AI Top Banner */}
            <div className="p-4 rounded-2xl bg-[#09152b] border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">
                    Mandatory Responsible AI Disclosure
                  </h4>
                  <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                    "{card.responsible_ai_disclaimer}"
                  </p>
                </div>
              </div>
              <span className="shrink-0 px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-xs font-mono">
                Assisted Support Only
              </span>
            </div>

            {/* Section 1: Overview & Purpose */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 space-y-4">
                <CardHeader>
                  <div className="flex items-center gap-2.5">
                    <BrainCircuit className="w-5 h-5 text-cyan-400" />
                    <div>
                      <CardTitle>Model Overview & Intended Use</CardTitle>
                      <CardDescription>System classification, operational scope, and deployment context</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-xs sm:text-sm">
                  <div>
                    <span className="font-semibold text-slate-400 block mb-1">Purpose</span>
                    <p className="text-slate-200 leading-relaxed">{card.purpose}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400 block mb-1">Intended Use & Operational Boundary</span>
                    <p className="text-slate-200 leading-relaxed">{card.intended_use}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400 block mb-1">Human Review Requirement</span>
                    <p className="text-slate-200 leading-relaxed">{card.human_review_requirement}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Technical Specifications */}
              <Card className="space-y-4">
                <CardHeader>
                  <CardTitle>Model Metadata</CardTitle>
                  <CardDescription>Source of truth from model registry</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#16273f]">
                    <span className="text-slate-400">Model Name</span>
                    <span className="font-semibold text-white">{card.model_name}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#16273f]">
                    <span className="text-slate-400">Model Version</span>
                    <span className="font-mono font-bold text-cyan-400">v{card.model_version}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#16273f]">
                    <span className="text-slate-400">Algorithm</span>
                    <span className="font-semibold text-white">{card.algorithm}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#16273f]">
                    <span className="text-slate-400">Features</span>
                    <span className="font-mono text-white">{card.feature_count} inputs</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#16273f]">
                    <span className="text-slate-400">Training Dataset</span>
                    <span className="text-slate-200">{card.training_dataset}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Training Date</span>
                    <span className="text-slate-200">{card.training_date || "Reference Baseline"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 2: Known Evaluation Metrics */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Evaluation Metrics</CardTitle>
                    <CardDescription>
                      Empirically measured benchmark metrics from authoritative model metadata
                    </CardDescription>
                  </div>
                  <span className="text-xs font-mono text-slate-400">Source: model_metadata.json</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-4 rounded-xl bg-[#091322] border border-[#16273f] text-center">
                    <span className="text-xs text-slate-400 font-medium block mb-1">ROC-AUC</span>
                    <div className="text-2xl font-extrabold text-cyan-400 font-['Space_Grotesk']">
                      {card.evaluation_metrics.roc_auc !== null
                        ? card.evaluation_metrics.roc_auc.toFixed(4)
                        : "—"}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Discrimination Power</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#091322] border border-[#16273f] text-center">
                    <span className="text-xs text-slate-400 font-medium block mb-1">Accuracy</span>
                    <div className="text-2xl font-extrabold text-white font-['Space_Grotesk']">
                      {card.evaluation_metrics.accuracy !== null
                        ? `${(card.evaluation_metrics.accuracy * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Overall Concordance</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#091322] border border-[#16273f] text-center">
                    <span className="text-xs text-slate-400 font-medium block mb-1">Precision</span>
                    <div className="text-2xl font-extrabold text-white font-['Space_Grotesk']">
                      {card.evaluation_metrics.precision !== null
                        ? `${(card.evaluation_metrics.precision * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Positive Predictive Val</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#091322] border border-[#16273f] text-center">
                    <span className="text-xs text-slate-400 font-medium block mb-1">Recall</span>
                    <div className="text-2xl font-extrabold text-emerald-400 font-['Space_Grotesk']">
                      {card.evaluation_metrics.recall !== null
                        ? `${(card.evaluation_metrics.recall * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Default Sensitivity</span>
                  </div>

                  <div className="p-4 rounded-xl bg-[#091322] border border-[#16273f] text-center">
                    <span className="text-xs text-slate-400 font-medium block mb-1">F1 Score</span>
                    <div className="text-2xl font-extrabold text-white font-['Space_Grotesk']">
                      {card.evaluation_metrics.f1_score !== null
                        ? card.evaluation_metrics.f1_score.toFixed(2)
                        : "—"}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Harmonic Mean</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Risk Thresholds & Explainability Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Risk Bands */}
              <Card>
                <CardHeader>
                  <CardTitle>Risk Thresholds & Score Bands</CardTitle>
                  <CardDescription>Authorized risk tier definitions and score normalization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-400 block">LOW RISK</span>
                      <span className="text-slate-300 text-[11px]">{card.risk_thresholds.low}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">Score 0–24</span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-400 block">MEDIUM RISK</span>
                      <span className="text-slate-300 text-[11px]">{card.risk_thresholds.medium}</span>
                    </div>
                    <span className="font-mono font-bold text-amber-400">Score 25–55</span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-rose-400 block">HIGH RISK</span>
                      <span className="text-slate-300 text-[11px]">{card.risk_thresholds.high}</span>
                    </div>
                    <span className="font-mono font-bold text-rose-400">Score 56–100</span>
                  </div>
                </CardContent>
              </Card>

              {/* Explainability Structure */}
              <Card>
                <CardHeader>
                  <CardTitle>Explainability Architecture</CardTitle>
                  <CardDescription>SHAP feature attribution taxonomy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="text-slate-300">
                    Methodology: <b className="text-white font-mono">{card.explainability.method}</b>
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <span className="text-slate-400 block">Categorized Signal Dimensions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {card.explainability.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2.5 py-1 rounded-lg bg-[#0c1a2f] border border-[#1a3359] text-cyan-300 text-[11px] font-medium"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section 4: Responsible AI, Fairness & Known Limitations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="border-b border-[#16273f]">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Scale className="w-5 h-5" />
                    <CardTitle className="text-amber-400">Fairness & Responsible AI</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4 text-xs">
                  <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 font-mono text-[11px]">
                    Status: {card.fairness_considerations.status}
                  </div>
                  <ul className="space-y-2 text-slate-300">
                    {card.fairness_considerations.notes.map((note, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-[#16273f]">
                  <div className="flex items-center gap-2 text-slate-300">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <CardTitle>Known Model Limitations</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-4 text-xs text-slate-300">
                  <ul className="space-y-2">
                    {card.known_limitations.map((lim, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{lim}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
