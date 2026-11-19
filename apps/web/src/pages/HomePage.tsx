import { formatDuration, type RuntimeWarning } from '@outagekit/runtime';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BatteryPanel } from '../components/BatteryPanel';
import { DeviceList } from '../components/DeviceList';
import { Dial } from '../components/Dial';
import { Icon } from '../components/Icon';
import { PlanSteps } from '../components/PlanSteps';
import { Warnings } from '../components/Warnings';
import { formatClock, formatPercent, formatWatts, toneFor } from '../lib/format';
import { buildPlan } from '../lib/plan';
import { hrefFor } from '../lib/router';
import { useStore } from '../state/store';

function useOutOfView<T extends Element>() {
  const ref = useRef<T>(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setOut(!entry?.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, out] as const;
}

export function HomePage() {
  const { state, dispatch, computed, now } = useStore();
  const [dialRef, dialHidden] = useOutOfView<HTMLDivElement>();
  const steps = useMemo(() => buildPlan(state, computed, now), [state, computed, now]);
  const hours = computed.hours;
  const finite = Number.isFinite(hours);
  const mode = computed.inOutage ? 'outage' : 'planning';
  const leaveIn = computed.leaveAt
    ? (computed.leaveAt.getTime() - now.getTime()) / 3_600_000
    : null;

  const extra: RuntimeWarning[] = [];
  if (computed.hasLifeSustaining && finite && computed.estimate.hours < 4) {
    extra.push({
      code: 'low-charge',
      severity: 'danger',
      message:
        'Under 4 hours for life-sustaining equipment. Ask your equipment supplier about extra batteries or oxygen cylinders, and plan where to go.',
    });
  }

  const firstSource = state.sources[0];
  const firstRuntime = computed.estimate.sources[0];
  const summary = finite
    ? `Your setup runs ${formatDuration(hours)}`
    : state.devices.length === 0
      ? 'Add your devices to see how long your battery lasts'
      : 'Nothing is switched on';

  return (
    <>
      {dialHidden && finite && (
        <div className={`mini-dial mini-dial-${toneFor(hours)}`} aria-hidden="true">
          <Icon name="bolt" size={16} />
          <strong>{formatDuration(hours, 'short')}</strong>
          <span>{computed.inOutage ? 'left' : 'runtime'}</span>
        </div>
      )}

      {state.isExample && (
        <div className="example-banner" role="note">
          <p>
            <strong>This is an example setup.</strong> Change it to match your home: add your own
            devices and battery, then remove what you do not have.
          </p>
          <div className="example-actions">
            <button
              type="button"
              className="button"
              onClick={() => dispatch({ type: 'example/keep' })}
            >
              Keep and edit
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => dispatch({ type: 'example/clear' })}
            >
              Start empty
            </button>
          </div>
        </div>
      )}

      <section
        className={`hero ${computed.inOutage ? 'hero-outage' : ''}`}
        aria-labelledby="runtime-summary"
      >
        <div className="hero-dial" ref={dialRef}>
          <Dial
            hours={hours}
            endsAt={computed.endsAt}
            now={now}
            mode={mode}
            leaveInHours={leaveIn}
          />
        </div>
        <div className="hero-text">
          {computed.inOutage && state.outage && (
            <p className="outage-pill" role="status">
              <span className="pulse" aria-hidden="true" /> Power out since{' '}
              {formatClock(new Date(state.outage.startedAt), now)} ·{' '}
              {formatDuration(computed.outageElapsedHours, 'short')} ago
            </p>
          )}
          <h1 id="runtime-summary" aria-live="polite" data-testid="runtime-summary">
            {computed.inOutage && finite ? `${formatDuration(hours)} left` : summary}
          </h1>
          {finite && computed.endsAt && (
            <p className="hero-sub">
              {computed.inOutage
                ? 'Battery expected to run out at'
                : 'If the power went out now, it would last until'}{' '}
              <strong>{formatClock(computed.endsAt, now)}</strong>.
              {computed.leaveAt && (
                <>
                  {' '}
                  Leave by <strong>{formatClock(computed.leaveAt, now)}</strong>.
                </>
              )}
            </p>
          )}
          {firstSource && firstRuntime && (
            <p className="hero-meta">
              {firstSource.name} at {formatPercent(firstRuntime.stateOfCharge)} ·{' '}
              {formatWatts(computed.estimate.loads.totalAverageW)} average from{' '}
              {computed.estimate.loads.count}{' '}
              {computed.estimate.loads.count === 1 ? 'device' : 'devices'}
              {state.sources.length > 1 ? ` · ${state.sources.length} batteries` : ''}
            </p>
          )}
          <div className="hero-actions">
            {computed.inOutage ? (
              <button
                type="button"
                className="button button-large"
                onClick={() => {
                  if (window.confirm('Is the power back on? This stops the countdown.')) {
                    dispatch({ type: 'outage/end' });
                  }
                }}
              >
                <Icon name="check" /> Power is back
              </button>
            ) : (
              <button
                type="button"
                className="button button-large button-outage"
                onClick={() => dispatch({ type: 'outage/start' })}
                disabled={state.sources.length === 0}
              >
                <Icon name="bolt" /> Power is out: start countdown
              </button>
            )}
            <a className="button button-large" href={hrefFor('card')}>
              <Icon name="card" /> Fridge card
            </a>
          </div>
          <Warnings warnings={computed.estimate.warnings} extra={extra} />
        </div>
      </section>

      <div className="layout">
        <div className="layout-main">
          <DeviceList />
          <BatteryPanel />
        </div>
        <aside className="layout-side" aria-labelledby="plan-title">
          <div className="side-sticky">
            <header className="section-header">
              <div>
                <h2 id="plan-title">The plan, in order</h2>
                <p className="section-description">
                  Updates as you change devices.{' '}
                  <a href={hrefFor('plan')}>Add who to call and where to go</a>.
                </p>
              </div>
            </header>
            <PlanSteps steps={steps} />
          </div>
        </aside>
      </div>
    </>
  );
}
