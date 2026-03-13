import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors and prevents white screen crashes.
 * Shows a minimal recovery UI with reload option.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center bg-white">
          <div className="w-14 h-14 border-2 border-neutral-900 flex items-center justify-center mb-5">
            <span className="font-mono text-xl text-neutral-900">!</span>
          </div>
          <p className="font-heading text-base font-bold text-neutral-900 uppercase tracking-tight">
            Something went wrong
          </p>
          <p className="font-mono text-[11px] text-neutral-400 mt-2 max-w-xs leading-relaxed">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 font-mono text-[11px] font-medium px-4 py-2 text-neutral-900 border-2 border-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer uppercase tracking-wider"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
