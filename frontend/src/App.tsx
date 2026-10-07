import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthRoleProvider, useAuthRole } from "./context/AuthRoleContext";

// Import Public Pages
import Home from "./pages/Home";
import LoginLandingPage from "./pages/LoginLandingPage";
import { UserLoginPage, AnalystLoginPage, AdminLoginPage } from "./pages/PortalLogin";
import Register from "./pages/Register";
import FeaturesPage from "./pages/FeaturesPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import SecurityPage from "./pages/SecurityPage";
import AboutPage from "./pages/AboutPage";
import FaqPage from "./pages/FaqPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import ResponsibleAiPage from "./pages/ResponsibleAiPage";
import ContactPage from "./pages/ContactPage";
import DemoPage from "./pages/DemoPage";
import NotFoundPage from "./pages/NotFoundPage";

// Import Authenticated Protected Pages
import Dashboard from "./pages/Dashboard";
import Assessment from "./pages/Assessment";
import Prediction from "./pages/Prediction";
import PredictionHistory from "./pages/PredictionHistory";
import ModelMonitoring from "./pages/ModelMonitoring";
import ModelCard from "./pages/ModelCard";
import Reports from "./pages/Reports";
import Businesses from "./pages/Businesses";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import AnalystDashboard from "./pages/AnalystDashboard";
import AssessmentReview from "./pages/AssessmentReview";

// Import Dedicated Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminAssessments from "./pages/admin/AdminAssessments";
import AdminAnalysts from "./pages/admin/AdminAnalysts";
import AdminRiskIntelligence from "./pages/admin/AdminRiskIntelligence";
import AdminDocuments from "./pages/admin/AdminDocuments";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminNotifications from "./pages/admin/AdminNotifications";

// Import UI Providers and Components
import LoadingSpinner from "./components/LoadingSpinner";
import ToastProvider from "./components/ui/Toast";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import CommandPalette from "./components/CommandPalette";
import OnboardingModal from "./components/OnboardingModal";
import { ShieldAlert } from "lucide-react";

// Authenticated Route Guard Component
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthRole();

  if (loading) {
    return <LoadingSpinner fullPage text="Checking authentication..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Role-Based Route Guard Component (for Analyst and Admin Portals)
function RoleRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const { user, role, loading, profileLoading } = useAuthRole();

  if (loading || profileLoading) {
    return <LoadingSpinner fullPage text="Verifying permissions..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = (role || "user").toLowerCase();
  const isAllowed = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);

  if (!isAllowed) {
    if (allowedRoles.includes("admin") && !allowedRoles.includes("user") && !allowedRoles.includes("analyst")) {
      return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#081120] border border-rose-500/30 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-300 text-sm mb-6">
              Access denied. Administrator privileges are required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={userRole === "analyst" ? "/analyst" : "/dashboard"}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition"
              >
                Return to Workspace
              </a>
              <a
                href="/login/admin"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition border border-slate-700"
              >
                Admin Login
              </a>
            </div>
          </div>
        </div>
      );
    }
    if (allowedRoles.includes("analyst") && !allowedRoles.includes("user")) {
      return (
        <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#081120] border border-amber-500/30 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-300 text-sm mb-6">
              Access denied. This portal is restricted to Credit Risk Analysts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/dashboard"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition"
              >
                Return to MSME Portal
              </a>
              <a
                href="/login/analyst"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition border border-slate-700"
              >
                Analyst Login
              </a>
            </div>
          </div>
        </div>
      );
    }
    if (userRole === "analyst") {
      return <Navigate to="/analyst" replace />;
    }
    // Redirect unauthorized users to their dedicated dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthRoleProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {/* Global Search & Command Palette (Ctrl+K) */}
            <CommandPalette />

            {/* First-time Onboarding Product Tour */}
            <OnboardingModal />

            <Routes>
              {/* Public SaaS Pages */}
              <Route path="/" element={<Home />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/responsible-ai" element={<ResponsibleAiPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/demo" element={<DemoPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />

              {/* Public Authentication Pages - Separate Login Architecture */}
              <Route path="/login" element={<LoginLandingPage />} />
              <Route path="/login/user" element={<UserLoginPage />} />
              <Route path="/login/analyst" element={<AnalystLoginPage />} />
              <Route path="/login/admin" element={<AdminLoginPage />} />
              <Route path="/register" element={<Register />} />

              {/* MSME Business Owner Portal Routes */}
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/businesses"
                element={
                  <PrivateRoute>
                    <Businesses />
                  </PrivateRoute>
                }
              />
              <Route
                path="/assessment"
                element={
                  <PrivateRoute>
                    <Assessment />
                  </PrivateRoute>
                }
              />
              <Route
                path="/prediction"
                element={
                  <PrivateRoute>
                    <Prediction />
                  </PrivateRoute>
                }
              />
              <Route
                path="/prediction-history"
                element={
                  <PrivateRoute>
                    <PredictionHistory />
                  </PrivateRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <PrivateRoute>
                    <Documents />
                  </PrivateRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <PrivateRoute>
                    <Reports />
                  </PrivateRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <PrivateRoute>
                    <Settings />
                  </PrivateRoute>
                }
              />

              {/* Analyst Review Portal Routes (Restricted to Analyst and Admin) */}
              <Route
                path="/analyst"
                element={
                  <RoleRoute allowedRoles={["analyst", "admin"]}>
                    <AnalystDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="/analyst/reviews"
                element={
                  <RoleRoute allowedRoles={["analyst", "admin"]}>
                    <AnalystDashboard initialTab="queue" />
                  </RoleRoute>
                }
              />
              <Route
                path="/analyst/review/:id"
                element={
                  <RoleRoute allowedRoles={["analyst", "admin"]}>
                    <AssessmentReview />
                  </RoleRoute>
                }
              />

              {/* Admin Portal Routes (Restricted to Admin Only) */}
              <Route
                path="/admin"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminUsers />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/businesses"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminBusinesses />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/assessments"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminAssessments />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/analysts"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminAnalysts />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/risk-intelligence"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminRiskIntelligence />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/model-monitoring"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <ModelMonitoring />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/model-card"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <ModelCard />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/documents"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminDocuments />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/notifications"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminNotifications />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminAuditLogs />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminSettings />
                  </RoleRoute>
                }
              />

              {/* Fallback 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AuthRoleProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}