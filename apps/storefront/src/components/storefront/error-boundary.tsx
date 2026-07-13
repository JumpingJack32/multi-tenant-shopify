"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { trackError } from "@/lib/error-tracking";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: Record<string, unknown>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    trackError(error, {
      componentStack: info.componentStack ?? undefined,
      ...this.props.context,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 text-muted-foreground">
          <p className="text-sm">Something went wrong.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm underline hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
