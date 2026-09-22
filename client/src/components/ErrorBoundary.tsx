import React from 'react';

interface Props {
  title: string;
  body: string;
  retry: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[AetherDesk] view crashed:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="glass-panel p-8 rounded-2xl border border-rose-500/30 text-center space-y-3">
          <div className="text-sm font-bold text-rose-300">{this.props.title}</div>
          <div className="text-xs text-slate-400 font-mono max-w-md mx-auto break-all">
            {String(this.state.error.message || this.state.error)}
          </div>
          <div className="text-xs text-slate-500">{this.props.body}</div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
          >
            {this.props.retry}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
