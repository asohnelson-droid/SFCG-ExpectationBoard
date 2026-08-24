import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-zinc-900">Something went wrong</h1>
            <p className="text-zinc-500 max-w-md mx-auto">
              An unexpected error occurred. We've been notified and are looking into it.
            </p>
            {this.state.error && (
              <pre className="mt-4 p-4 bg-zinc-100 rounded-xl text-xs text-zinc-600 overflow-auto max-w-lg text-left">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Page
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-white border border-zinc-200 text-zinc-900 rounded-xl font-semibold flex items-center gap-2 hover:bg-zinc-50 transition-colors"
            >
              <Home className="w-5 h-5" />
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
