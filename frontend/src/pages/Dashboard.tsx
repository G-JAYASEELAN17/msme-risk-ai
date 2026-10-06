import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  PlusCircle,
  Activity,
  Layers,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  BarChart3,
  Sliders,
  DollarSign,
  PieChart as PieIcon,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, DashboardStats } from "../services/api";
import Sidebar from "../components/Sidebar";
import StatCard from "../components/StatCard";
import Button from "../components/ui/Button";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge } from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import { Skeleton } from "../components/ui/Skeleton";
import WhatIfSimulator from "../components/WhatIfSimulator";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState<string>("Underwriter");
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);
  const [hoveredScatterIndex, setHoveredScatterIndex] = useState<number | null>(null);

  // Date Range state
  const [dateRange, setDateRange] = useState<string>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [showSimulatorModal, setShowSimulatorModal] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      } else {
        const name = user.displayName
          ? user.displayName.split(" ")[0]
          : (user.email ? user.email.split("@")[0] : "Underwriter");
        if (isMounted) {
          setUserName(name);
          fetchStats(dateRange);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [navigate]);

  const fetchStats = async (range: string = dateRange, start?: string, end?: string) => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getDashboardStats(
        range, 
        range === "custom" ? (start || customStart) : undefined, 
        range === "custom" ? (end || customEnd) : undefined
      );
      setStats(data);
    } catch (err: any) {
      console.error("Dashboard load error:", err);
      setError(err?.message || "Could not retrieve portfolio statistics.");
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (newRange: string) => {
    setDateRange(newRange);
    if (newRange !== "custom") {
      fetchStats(newRange);
    }
  };

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    fetchStats("custom", customStart, customEnd);
  };

  const exportPortfolioCSV = () => {
    if (!stats || !stats.recent_assessments || stats.recent_assessments.length === 0) return;
    const headers = ["ID", "Business Name", "Industry", "Default Probability (%)", "Risk Level", "Assessment Date"];
    const rows = stats.recent_assessments.map(item => [
      item.id,
      `"${item.business_name.replace(/"/g, '""')}"`,
      `"${item.industry.replace(/"/g, '""')}"`,
      item.default_probability.toFixed(2),
      item.risk_level,
      item.created_at,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `MSME_Portfolio_Assessments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const total = stats?.total_assessments || 0;
  const low = stats?.low_risk_count || 0;
  const med = stats?.medium_risk_count || 0;
  const high = stats?.high_risk_count || 0;
  const recent = stats?.recent_assessments || [];
  const trends = stats?.assessment_trends || [];
  const industryStats = stats?.industry_comparison || [];
  const revenueScatter = stats?.revenue_vs_risk || [];

  const lowPct = total > 0 ? Math.round((low / total) * 100) : 0;
  const medPct = total > 0 ? Math.round((med / total) * 100) : 0;
  const highPct = total > 0 ? Math.round((high / total) * 100) : 0;

  // Build SVG path for trends chart
  const generateTrendPath = () => {
    if (trends.length === 0) {
      return { line: "M 0 140 L 650 140", area: "M 0 140 L 650 140 L 650 180 L 0 180 Z", points: [] };
    }

    const maxCount = Math.max(...trends.map((t) => t.count), 1);
    const width = 650;
    const height = 180;
    const paddingBottom = 30;
    const paddingTop = 25;
    const usableHeight = height - paddingBottom - paddingTop;
    const stepX = width / Math.max(trends.length - 1, 1);

    const points = trends.map((t, i) => {
      const x = i * stepX;
      const y = height - paddingBottom - (t.count / maxCount) * usableHeight;
      return { x, y, date: t.date, count: t.count };
    });

    let lineD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      lineD += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const areaD = `${lineD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    return { line: lineD, area: areaD, points };
  };

  const trendData = generateTrendPath();

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="app-layout">
      <Sidebar active="Overview" />

      <main className="main-content space-y-8">
        {/* Dashboard Header with greeting and primary action */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#16273f]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formattedDate}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-['Space_Grotesk']">
              Good day, {userName}.
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {total > 0
                ? `You have ${total} total loan assessments registered in your portfolio.`
                : "Welcome to your loan underwriting workspace. Start with your first risk assessment."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Selector */}
            <div className="flex items-center bg-[#0a1526] border border-[#1a2e4c] rounded-xl p-1 text-xs">
              {["7d", "30d", "90d", "custom"].map((r) => (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                    dateRange === r
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r === "90d" ? "90 Days" : "Custom"}
                </button>
              ))}
            </div>

            <button
              onClick={() => fetchStats(dateRange)}
              className="p-2.5 bg-[#0a1526] hover:bg-[#12233c] text-slate-300 border border-[#1a2e4c] rounded-xl transition-colors"
              title="Refresh Stats"
            >
              <RefreshCw size={15} className={loading ? "animate-spin text-cyan-400" : ""} />
            </button>

            <button
              onClick={() => setShowSimulatorModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-semibold transition-all"
            >
              <Sliders size={14} className="text-cyan-400" />
              <span>Risk Simulator</span>
            </button>

            {total > 0 && (
              <button
                onClick={exportPortfolioCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-semibold transition-all"
                title="Export CSV"
              >
                <Download size={14} className="text-emerald-400" />
                <span>Export CSV</span>
              </button>
            )}

            <Button
              variant="primary"
              size="md"
              icon={<PlusCircle className="w-4 h-4" />}
              onClick={() => navigate("/assessment")}
            >
              New Assessment
            </Button>
          </div>
        </div>

        {/* Custom Date Form (if active) */}
        {dateRange === "custom" && (
          <form onSubmit={handleApplyCustomDate} className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-slate-300">Select Date Range:</span>
            <input
              type="date"
              required
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              required
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors"
            >
              Apply Filter
            </button>
          </form>
        )}

        {/* Global Error Notice if any */}
        {error && <ErrorMessage message={error} onRetry={() => fetchStats(dateRange)} />}

        {/* 4 Stat Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Assessments"
            value={loading ? "-" : total}
            icon={<Layers className="w-4 h-4" />}
            subtitle={total > 0 ? "Active credit profiles" : "No assessments yet"}
            loading={loading}
          />
          <StatCard
            label="Low Risk Tier"
            value={loading ? "-" : low}
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            subtitle={total > 0 ? `${lowPct}% of portfolio` : "Awaiting evaluations"}
            loading={loading}
          />
          <StatCard
            label="Medium Risk Tier"
            value={loading ? "-" : med}
            icon={<Activity className="w-4 h-4 text-amber-400" />}
            subtitle={total > 0 ? `${medPct}% of portfolio` : "Awaiting evaluations"}
            loading={loading}
          />
          <StatCard
            label="High Risk Flagged"
            value={loading ? "-" : high}
            icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
            subtitle={total > 0 ? `${highPct}% high risk` : "Awaiting evaluations"}
            loading={loading}
          />
        </div>

        {/* Analytics Section: Velocity Chart & Donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart (2 cols) */}
          <Card className="lg:col-span-2 flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Assessment Velocity</CardTitle>
                  <CardDescription>Submissions and evaluation volume over selected timeline ({dateRange})</CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-full">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="uppercase">{dateRange} Activity</span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="h-56 w-full flex items-center justify-center">
                  <Skeleton className="h-44 w-full rounded-xl" />
                </div>
              ) : total === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-[#081120]/40 rounded-xl border border-dashed border-[#1a2d4b]">
                  <Activity className="w-8 h-8 text-slate-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No trend data available</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Once you submit loan applications, daily activity and velocity will appear here.
                  </p>
                </div>
              ) : (
                <div className="relative pt-2">
                  <div className="relative h-48 w-full">
                    {/* SVG Graphic */}
                    <svg viewBox="0 0 650 180" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[30, 80, 130, 170].map((y) => (
                        <line
                          key={y}
                          x1="0"
                          y1={y}
                          x2="650"
                          y2={y}
                          stroke="#172740"
                          strokeDasharray="4 4"
                          strokeWidth="1"
                        />
                      ))}

                      {/* Area Fill */}
                      <path d={trendData.area} fill="url(#trendGradient)" />

                      {/* Curve Line */}
                      <path
                        d={trendData.line}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />

                      {/* Interactive Points */}
                      {trendData.points.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={hoveredTrendIndex === i ? 6 : 4}
                          className="cursor-pointer transition-all duration-150"
                          fill={hoveredTrendIndex === i ? "#ffffff" : "#0284c7"}
                          stroke="#38bdf8"
                          strokeWidth={hoveredTrendIndex === i ? 3 : 2}
                          onMouseEnter={() => setHoveredTrendIndex(i)}
                          onMouseLeave={() => setHoveredTrendIndex(null)}
                        />
                      ))}
                    </svg>

                    {/* Tooltip Overlay */}
                    {hoveredTrendIndex !== null && trendData.points[hoveredTrendIndex] && (
                      <div
                        className="absolute z-20 px-2.5 py-1.5 rounded-lg bg-[#0f1d33] border border-cyan-500/40 text-[11px] text-white shadow-xl shadow-black/80 pointer-events-none transform -translate-x-1/2 -translate-y-full"
                        style={{
                          left: `${(trendData.points[hoveredTrendIndex].x / 650) * 100}%`,
                          top: `${(trendData.points[hoveredTrendIndex].y / 180) * 100}%`,
                          marginTop: "-8px",
                        }}
                      >
                        <span className="font-semibold text-cyan-400">{trendData.points[hoveredTrendIndex].count}</span>{" "}
                        assessments on {trendData.points[hoveredTrendIndex].date}
                      </div>
                    )}
                  </div>

                  {/* X-axis Date labels */}
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 px-1">
                    {trends.map((t, idx) => (
                      <span key={idx} className="font-medium">
                        {t.date}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk Distribution Donut (1 col) */}
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Portfolio risk composition by category</CardDescription>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="h-56 flex items-center justify-center">
                  <Skeleton className="h-36 w-36 rounded-full" />
                </div>
              ) : total === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-center p-6 bg-[#081120]/40 rounded-xl border border-dashed border-[#1a2d4b]">
                  <ShieldCheck className="w-8 h-8 text-slate-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-300">No risk classifications</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Breakdown will appear as assessments are calculated.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-6 py-2">
                  <div className="relative w-36 h-36 rounded-full flex items-center justify-center shadow-lg shadow-black/40">
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        background: `conic-gradient(
                          #10b981 0% ${lowPct}%,
                          #f59e0b ${lowPct}% ${lowPct + medPct}%,
                          #ef4444 ${lowPct + medPct}% 100%
                        )`,
                      }}
                    />
                    <div className="absolute inset-3 rounded-full bg-[#0c1729] flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-white font-['Space_Grotesk']">
                        {lowPct}%
                      </span>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-400">
                        Low Risk
                      </span>
                    </div>
                  </div>

                  {/* Legend list */}
                  <div className="w-full space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#081222]/80 border border-[#16273f]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span className="text-slate-300">Low Risk</span>
                      </div>
                      <span className="font-semibold text-white">
                        {low} <span className="text-slate-500 font-normal">({lowPct}%)</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#081222]/80 border border-[#16273f]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="text-slate-300">Medium Risk</span>
                      </div>
                      <span className="font-semibold text-white">
                        {med} <span className="text-slate-500 font-normal">({medPct}%)</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#081222]/80 border border-[#16273f]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                        <span className="text-slate-300">High Risk</span>
                      </div>
                      <span className="font-semibold text-white">
                        {high} <span className="text-slate-500 font-normal">({highPct}%)</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Advanced Analytics: Industry Comparison & Revenue vs Risk Scatter */}
        {industryStats.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Industry Comparison */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Industry Risk Comparison</CardTitle>
                    <CardDescription>Average default probability across economic sectors</CardDescription>
                  </div>
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {industryStats.map((ind) => (
                    <div key={ind.industry} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-white capitalize">{ind.industry} ({ind.count})</span>
                        <span className="text-cyan-300 font-mono">{ind.avg_default_probability.toFixed(1)}% Avg Risk</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                        <div 
                          className="bg-emerald-500 h-full" 
                          style={{ width: `${(ind.low_risk_count / Math.max(ind.count, 1)) * 100}%` }} 
                          title={`Low Risk: ${ind.low_risk_count}`}
                        />
                        <div 
                          className="bg-amber-500 h-full" 
                          style={{ width: `${(ind.medium_risk_count / Math.max(ind.count, 1)) * 100}%` }} 
                          title={`Medium Risk: ${ind.medium_risk_count}`}
                        />
                        <div 
                          className="bg-rose-500 h-full" 
                          style={{ width: `${(ind.high_risk_count / Math.max(ind.count, 1)) * 100}%` }} 
                          title={`High Risk: ${ind.high_risk_count}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Revenue vs Risk Scatter */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Revenue vs. Risk Matrix</CardTitle>
                    <CardDescription>Borrower annual revenue against default probability</CardDescription>
                  </div>
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                </div>
              </CardHeader>
              <CardContent>
                {revenueScatter.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-slate-500 text-xs">
                    No revenue matrix data available.
                  </div>
                ) : (
                  <div className="relative h-48 w-full bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 overflow-hidden">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between p-3 opacity-20 pointer-events-none">
                      <div className="border-b border-cyan-500/50 w-full" />
                      <div className="border-b border-cyan-500/50 w-full" />
                      <div className="border-b border-cyan-500/50 w-full" />
                    </div>

                    <div className="relative w-full h-full">
                      {revenueScatter.map((pt, idx) => {
                        const maxRev = Math.max(...revenueScatter.map(p => p.annual_revenue), 100000);
                        const posX = Math.min(Math.max((pt.annual_revenue / maxRev) * 90 + 5, 5), 95);
                        const posY = Math.min(Math.max(100 - pt.default_probability, 5), 95);

                        return (
                          <div
                            key={pt.id}
                            className={`absolute w-3.5 h-3.5 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform duration-200 ${
                              pt.risk_level === 'Low' ? 'bg-emerald-400 ring-2 ring-emerald-500/30' :
                              pt.risk_level === 'Medium' ? 'bg-amber-400 ring-2 ring-amber-500/30' :
                              'bg-rose-400 ring-2 ring-rose-500/30'
                            } ${hoveredScatterIndex === idx ? 'scale-150 z-20' : 'hover:scale-125 z-10'}`}
                            style={{ left: `${posX}%`, top: `${posY}%` }}
                            onMouseEnter={() => setHoveredScatterIndex(idx)}
                            onMouseLeave={() => setHoveredScatterIndex(null)}
                            onClick={() => navigate(`/reports?id=${pt.id}`)}
                          />
                        );
                      })}

                      {hoveredScatterIndex !== null && revenueScatter[hoveredScatterIndex] && (
                        <div 
                          className="absolute z-30 p-2 rounded-lg bg-[#0f1d33] border border-cyan-500/40 text-[11px] text-white shadow-2xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
                          style={{
                            left: `${Math.min(Math.max((revenueScatter[hoveredScatterIndex].annual_revenue / Math.max(...revenueScatter.map(p => p.annual_revenue), 100000)) * 90 + 5, 10), 90)}%`,
                            top: `${Math.min(Math.max(100 - revenueScatter[hoveredScatterIndex].default_probability, 10), 90)}%`,
                            marginTop: "-8px",
                          }}
                        >
                          <div className="font-bold text-white">{revenueScatter[hoveredScatterIndex].business_name}</div>
                          <div className="text-cyan-300">Revenue: ${revenueScatter[hoveredScatterIndex].annual_revenue.toLocaleString()}</div>
                          <div className="text-slate-300">Risk: {revenueScatter[hoveredScatterIndex].default_probability.toFixed(1)}% ({revenueScatter[hoveredScatterIndex].risk_level})</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Assessments Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Assessments</CardTitle>
              <CardDescription>Latest risk profiles evaluated by the ML prediction model</CardDescription>
            </div>
            {recent.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                iconPosition="right"
                onClick={() => navigate("/reports")}
              >
                View all reports
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-0 sm:p-0">
            {loading ? (
              <div className="p-6">
                <Skeleton className="h-12 w-full rounded-lg mb-2" />
                <Skeleton className="h-12 w-full rounded-lg mb-2" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : recent.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<FileSpreadsheet className="w-7 h-7" />}
                  title="No assessment records yet"
                  description="Create your first MSME loan risk assessment to generate real-time default probabilities and explainable insights."
                  actionText="Start First Assessment"
                  actionIcon={<Sparkles className="w-4 h-4" />}
                  onAction={() => navigate("/assessment")}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#081222] border-b border-[#16273f] text-slate-400 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5 font-semibold">Business Name</th>
                      <th className="px-6 py-3.5 font-semibold">Industry</th>
                      <th className="px-6 py-3.5 font-semibold">Default Probability</th>
                      <th className="px-6 py-3.5 font-semibold">Risk Classification</th>
                      <th className="px-6 py-3.5 font-semibold">Assessment Date</th>
                      <th className="px-6 py-3.5 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#14233a]">
                    {recent.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[#0f213a]/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/reports?id=${item.id}`)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{item.business_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">MSME-{item.id}24</div>
                        </td>
                        <td className="px-6 py-4 text-slate-300 capitalize">{item.industry}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-slate-100">
                            {item.default_probability.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <RiskBadge riskLevel={item.risk_level} size="sm" />
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-xs">
                          {new Date(item.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/reports?id=${item.id}`)}
                            className="text-cyan-400 hover:text-cyan-300"
                          >
                            View Report
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal: Risk Simulator */}
        {showSimulatorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white font-['Space_Grotesk'] flex items-center gap-2">
                  <Sliders className="text-cyan-400" />
                  What-If Risk Simulator
                </h3>
                <button
                  onClick={() => setShowSimulatorModal(false)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
              <WhatIfSimulator />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
