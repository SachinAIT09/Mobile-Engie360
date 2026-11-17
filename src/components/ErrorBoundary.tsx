import { Component, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { useI18n } from '../lib/i18n';

function Fallback() {
  const { t } = useI18n();
  return (
    <div className="app-error" role="alert">
      <h1>{t('This screen could not be loaded', 'Dit scherm kon niet worden geladen')}</h1>
      <p>{t('Check your connection and try again.', 'Controleer je verbinding en probeer het opnieuw.')}</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>
        <RotateCw size={17} /> {t('Try again', 'Opnieuw proberen')}
      </button>
    </div>
  );
}

/**
 * Last line of defence: if a screen fails to load or render, show a way back instead of a blank page.
 * (Error boundaries have to be class components.)
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[app] screen failed', error);
  }

  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
