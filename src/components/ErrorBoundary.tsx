import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Rendering Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearStorageAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-6 bg-rose-50 border-b border-rose-100 flex items-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Application Error Detected</h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  An unexpected issue occurred while rendering this view.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {this.state.error && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-auto max-h-40">
                  <p className="font-semibold text-rose-400 mb-1">{this.state.error.toString()}</p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-slate-400 whitespace-pre-wrap mt-2 text-[10px]">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              <p className="text-sm text-slate-600 leading-relaxed">
                ScanTrack Pro automatically caught this error to prevent a total app freeze. You can try refreshing the page or clearing cached session data if the issue persists.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition shadow-sm text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload App
                </button>
                <button
                  onClick={this.handleClearStorageAndReload}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition text-sm"
                >
                  <Home className="w-4 h-4" />
                  Reset Session
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
