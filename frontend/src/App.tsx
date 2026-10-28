import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthRoleProvider, useAuthRole } from "./context/AuthRoleContext";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import PageLoading from "./components/PageLoading";

// Code-split Public Pages
const Home = React.lazy(() => import("./pages/Home"));
const LoginLandingPage = React.lazy(() => import("./pages/LoginLandingPage"));
const UserLoginPage = React.lazy(() =>
  import("./pages/PortalLogin").then((m) => ({ default: m.UserLoginPage }))
);
const AnalystLoginPage = React.lazy(() =>
  import("./pages/PortalLogin").then((m) => ({ default: m.AnalystLoginPage }))
);
const AdminLoginPage = React.lazy(() =>
  import("./pages/PortalLogin").then((m) => ({ default: m.AdminLoginPage }))
);
const Register = React.lazy(() => import("./pages/Register"));
const VerifyEmail = React.lazy(() => import("./pages/VerifyEmail"));
const FeaturesPage = React.lazy(() => import("./pages/FeaturesPage"));
const HowItWorksPage = React.lazy(() => import("./pages/HowItWorksPage"));
const SecurityPage = React.lazy(() => import("./pages/SecurityPage"));
const AboutPage = React.lazy(() => import("./pages/AboutPage"));
const FaqPage = React.lazy(() => import("./pages/FaqPage"));
const PrivacyPage = React.lazy(() => import("./pages/PrivacyPage"));
const TermsPage = React.lazy(() => import("./pages/TermsPage"));
const ResponsibleAiPage = React.lazy(() => import("./pages/ResponsibleAiPage"));
const ContactPage = React.lazy(() => import("./pages/ContactPage"));
const DemoPage = React.lazy(() => import("./pages/DemoPage"));
const NotFoundPage = React.lazy(() => import("./pages/NotFoundPage"));

// Code-split Authenticated Protected Pages
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Assessment = React.lazy(() => import("./pages/Assessment"));
const Prediction = React.lazy(() => import("./pages/Prediction"));
const PredictionHistory = React.lazy(() => import("./pages/PredictionHistory"));
const ModelMonitoring = React.lazy(() => import("./pages/ModelMonitoring"));
const ModelCard = React.lazy(() => import("./pages/ModelCard"));
const Reports = React.lazy(() => import("./pages/Reports"));
const Businesses = React.lazy(() => import("./pages/Businesses"));
const Documents = React.lazy(() => import("./pages/Documents"));
const Settings = React.lazy(() => import("./pages/Settings"));
const FinancialIntelligence = React.lazy(() => import("./pages/FinancialIntelligence"));
const AnalystDashboard = React.lazy(() => import("./pages/AnalystDashboard"));
const AssessmentReview = React.lazy(() => import("./pages/AssessmentReview"));
const Explainability = React.lazy(() => import("./pages/Explainability"));

// Code-split Dedicated Admin Pages
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminBusinesses = React.lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminAssessments = React.lazy(() => import("./pages/admin/AdminAssessments"));
const AdminAnalysts = React.lazy(() => import("./pages/admin/AdminAnalysts"));
const AdminRiskIntelligence = React.lazy(() => import("./pages/admin/AdminRiskIntelligence"));
const AdminDocuments = React.lazy(() => import("./pages/admin/AdminDocuments"));
const AdminAuditLogs = React.lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminSettings = React.lazy(() => import("./pages/admin/AdminSettings"));
const AdminNotifications = React.lazy(() => import("./pages/admin/AdminNotifications"));

// Import UI Providers and Components
import LoadingSpinner from "./components/LoadingSpinner";
import ToastProvider from "./components/ui/Toast";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import CommandPalette from "./components/CommandPalette";
import OnboardingModal from "./components/OnboardingModal";
import { ShieldAlert } from "lucide-react";

// Authenticated Route Guard Component
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading, profileLoading } = useAuthRole();

  if (loading || (profileLoading && !userProfile)) {
    return <LoadingSpinner fullPage text="Checking authentication..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.emailVerified && !userProfile?.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (userProfile?.approval_status === "suspended") {
    return <Navigate to="/verify-email" replace />;
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
  const { user, userProfile, role, loading, profileLoading } = useAuthRole();

  if (loading || (profileLoading && !userProfile)) {
    return <LoadingSpinner fullPage text="Verifying permissions..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.emailVerified && !userProfile?.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }

  const userRole = (role || "user").toLowerCase();

  // If user is analyst, strictly enforce approval status
  if (userRole === "analyst") {
    const approval = userProfile?.approval_status || "pending_email_verification";
    if (approval !== "approved" && approval !== "active") {
      return <Navigate to="/verify-email" replace />;
    }
  }

  const isAllowed = allowedRoles.map((r) => r.toLowerCase()).includes(userRole);

  if (!isAllowed) {
    if (allowedRoles.includes("admin") && !allowedRoles.includes("user") && !allowedRoles.includes("analyst")) {
      return (
        <div className="min-h-screen bg-[#0C0A1D] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1C1933] border border-rose-500/30 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#F5F3FF] mb-2 font-display">Access Denied</h2>
            <p className="text-[#B7B1D1] text-sm mb-6">
              Access denied. Administrator privileges are required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={userRole === "analyst" ? "/analyst" : "/dashboard"}
                className="px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold transition shadow-md shadow-[#8B5CF6]/25"
              >
                Return to Workspace
              </a>
              <a
                href="/login/admin"
                className="px-4 py-2 rounded-xl bg-[#252141] hover:bg-[#30294D] text-[#F5F3FF] text-sm font-semibold transition border border-[#383154]"
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
        <div className="min-h-screen bg-[#0C0A1D] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#1C1933] border border-amber-500/30 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#F5F3FF] mb-2 font-display">Access Denied</h2>
            <p className="text-[#B7B1D1] text-sm mb-6">
              Access denied. This portal is restricted to Credit Risk Analysts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/dashboard"
                className="px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold transition shadow-md shadow-[#8B5CF6]/25"
              >
                Return to MSME Portal
              </a>
              <a
                href="/login/analyst"
                className="px-4 py-2 rounded-xl bg-[#252141] hover:bg-[#30294D] text-[#F5F3FF] text-sm font-semibold transition border border-[#383154]"
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

// Role-aware redirect for /notifications
function NotificationsRoute() {
  const { isAdmin } = useAuthRole();
  return <Navigate to={isAdmin ? "/admin/notifications" : "/settings?tab=alerts"} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
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

              <React.Suspense fallback={<PageLoading />}>
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
              <Route path="/verify-email" element={<VerifyEmail />} />

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
              <Route
                path="/notifications"
                element={
                  <PrivateRoute>
                    <NotificationsRoute />
                  </PrivateRoute>
                }
              />
              <Route
                path="/financial-intelligence"
                element={
                  <PrivateRoute>
                    <FinancialIntelligence />
                  </PrivateRoute>
                }
              />
              <Route
                path="/explainability"
                element={
                  <PrivateRoute>
                    <Explainability />
                  </PrivateRoute>
                }
              />
              <Route
                path="/explainability/:id"
                element={
                  <PrivateRoute>
                    <Explainability />
                  </PrivateRoute>
                }
              />

              {/* Analyst Review Portal Routes (Restricted to Analyst and Admin) */}
              <Route
                path="/analyst/explainability/:id"
                element={
                  <RoleRoute allowedRoles={["analyst", "admin"]}>
                    <Explainability />
                  </RoleRoute>
                }
              />
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
              <Route
                path="/analyst/financial-intelligence"
                element={
                  <RoleRoute allowedRoles={["analyst", "admin"]}>
                    <FinancialIntelligence />
                  </RoleRoute>
                }
              />
              <Route
                path="/analyst/financial-intelligence/:userId"
                element={
                  <RoleRoute allowedRoles={["analyst", "admin"]}>
                    <FinancialIntelligence />
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
                path="/admin/financial-intelligence"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <FinancialIntelligence />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/financial-intelligence/:userId"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <FinancialIntelligence />
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
          </React.Suspense>
        </BrowserRouter>
      </AuthRoleProvider>
    </ToastProvider>
  </QueryClientProvider>
</ErrorBoundary>
  );
}