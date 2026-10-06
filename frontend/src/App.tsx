import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./services/firebase";

// Import Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Assessment from "./pages/Assessment";
import Prediction from "./pages/Prediction";
import Reports from "./pages/Reports";
import Businesses from "./pages/Businesses";
import Documents from "./pages/Documents";
import Settings from "./pages/Settings";
import AnalystDashboard from "./pages/AnalystDashboard";
import AssessmentReview from "./pages/AssessmentReview";

// Import UI Providers and Components
import LoadingSpinner from "./components/LoadingSpinner";
import ToastProvider from "./components/ui/Toast";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import CommandPalette from "./components/CommandPalette";
import OnboardingModal from "./components/OnboardingModal";

// Protected Route Guard Component
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner fullPage text="Checking authentication..." />;
  }

  // Redirect to login if user is not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
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
            {/* Public Landing Page */}
            <Route path="/" element={<Home />} />

            {/* Public Authentication Pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Dashboard/Assessment Pages */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
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
              path="/businesses"
              element={
                <PrivateRoute>
                  <Businesses />
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
              path="/analyst"
              element={
                <PrivateRoute>
                  <AnalystDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/analyst/review/:id"
              element={
                <PrivateRoute>
                  <AssessmentReview />
                </PrivateRoute>
              }
            />

            {/* Fallback Redirection */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}