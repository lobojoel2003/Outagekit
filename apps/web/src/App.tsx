import { useEffect } from 'react';
import { Icon, type IconName } from './components/Icon';
import { Wordmark } from './components/Logo';
import { syncNotifications } from './lib/notify';
import { useInstallPrompt } from './lib/useInstallPrompt';
import { hrefFor, useRoute, type Route } from './lib/router';
import { AboutPage } from './pages/AboutPage';
import { CardPage } from './pages/CardPage';
import { HomePage } from './pages/HomePage';
import { PlanDetailsPage } from './pages/PlanDetailsPage';
import { RemindersPage } from './pages/RemindersPage';
import { StoreProvider, useStore } from './state/store';
import type { AppState } from './state/types';

const NAV: Array<{ route: Route; label: string; icon: IconName }> = [
  { route: 'home', label: 'Runtime', icon: 'dial' },
  { route: 'plan', label: 'Plan details', icon: 'list' },
  { route: 'card', label: 'Fridge card', icon: 'card' },
  { route: 'reminders', label: 'Reminders', icon: 'bell' },
  { route: 'about', label: 'About', icon: 'info' },
];

function NotificationSync() {
  const { state, computed, now } = useStore();
  const leaveAt = computed.leaveAt?.getTime() ?? 0;
  const endsAt = computed.endsAt?.getTime() ?? 0;
  // Re-plan when anything that changes the timing changes, not on every clock tick.
  const key = JSON.stringify([
    state.settings.remindersEnabled,
    state.settings.reminderIntervalDays,
    state.sources.map((s) => [s.uid, s.name, s.lastChargedAt]),
    state.outage?.segmentStartedAt ?? null,
    Math.round(leaveAt / 60_000),
    Math.round(endsAt / 60_000),
  ]);
  useEffect(() => {
    void syncNotifications(state, computed, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

function Shell() {
  const route = useRoute();
  const { computed } = useStore();
  const install = useInstallPrompt();
  return (
    <div className={`app ${computed.inOutage ? 'app-outage' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar no-print">
        <a href={hrefFor('home')} className="brand" aria-label="Outagekit home">
          <Wordmark />
        </a>
        <nav aria-label="Main" className="nav">
          {NAV.map((item) => (
            <a
              key={item.route}
              href={hrefFor(item.route)}
              aria-current={route === item.route ? 'page' : undefined}
              className="nav-link"
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {route === 'home' && <HomePage />}
        {route === 'plan' && <PlanDetailsPage />}
        {route === 'card' && <CardPage />}
        {route === 'reminders' && <RemindersPage />}
        {route === 'about' && <AboutPage />}
      </main>
      <footer className="site-footer no-print">
        <p>
          Estimates only, not medical advice. In an emergency call 911. Your data stays on this
          device.
        </p>
        {install && (
          <button type="button" className="button install-button" onClick={() => void install()}>
            <Icon name="download" size={18} /> Install Outagekit so it works offline
          </button>
        )}
      </footer>
      <NotificationSync />
    </div>
  );
}

export function App({ initialState }: { initialState?: AppState }) {
  return (
    <StoreProvider initialState={initialState}>
      <Shell />
    </StoreProvider>
  );
}
