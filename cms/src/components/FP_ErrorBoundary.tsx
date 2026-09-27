import { AlertOctagon, RotateCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import log from '../lib/log.js';
import FP_Button from './FP_Button';

export interface FP_ErrorBoundaryProps { children?: ReactNode }
interface State { error: Error | null }

/** Route-level boundary — one bad page must not white-screen the CMS. */
export default class FP_ErrorBoundary extends Component<FP_ErrorBoundaryProps, State> {
  constructor(props: FP_ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('render error:', error, info?.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="page">
        <div className="errorbox" role="alert">
          <div className="row row--top">
            <AlertOctagon size={18} className="danger" style={{ flex: '0 0 auto' }} />
            <div className="grow">
              <div className="errorbox__title">This page crashed</div>
              <div>{error.message || String(error)}</div>
              {error.stack ? (
                <details className="mt2">
                  <summary className="small muted" style={{ cursor: 'pointer' }}>Stack trace</summary>
                  <pre className="mono mt2" style={{ whiteSpace: 'pre-wrap' }}>{error.stack}</pre>
                </details>
              ) : null}
            </div>
            <FP_Button
              variant="secondary"
              size="sm"
              icon={RotateCw}
              onPress={() => this.setState({ error: null })}
            >
              Try again
            </FP_Button>
          </div>
        </div>
      </main>
    );
  }
}
