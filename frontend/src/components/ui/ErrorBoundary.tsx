import React, { Component, ErrorInfo, ReactNode } from "react";
import Button from "./Button";
import { AlertOctagon, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            An unexpected error occurred while rendering this view. Your session and data are safe.
          </p>
          {this.state.error && (
            <div className="p-3 mb-6 bg-[#0c1626] border border-rose-900/30 rounded-lg text-xs font-mono text-rose-300 max-w-lg text-left overflow-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              icon={<Home className="w-4 h-4" />}
              onClick={() => (window.location.href = "/dashboard")}
            >
              Go to Dashboard
            </Button>
            <Button
              variant="primary"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={this.handleReset}
            >
              Reload View
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
