import { chargeReminder, recommendedCheckIntervalDays } from '@outagekit/runtime';
import { useState } from 'react';
import { Section, SelectField } from '../components/fields';
import { Icon } from '../components/Icon';
import { currentCharge } from '../lib/compute';
import { saveFile } from '../lib/files';
import { formatDate, formatPercent } from '../lib/format';
import { recurringReminderIcs } from '../lib/ics';
import { notificationsAvailable, requestNotificationPermission } from '../lib/notify';
import { isNative } from '../lib/platform';
import { useStore } from '../state/store';

const INTERVALS = [
  { value: '7', label: 'Every week' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '30', label: 'Every month (recommended)' },
  { value: '60', label: 'Every 2 months' },
  { value: '90', label: 'Every 3 months' },
] as const;

export function RemindersPage() {
  const { state, dispatch, now } = useStore();
  const [permissionNote, setPermissionNote] = useState<string | null>(null);
  const interval = state.settings.reminderIntervalDays;

  const enable = async (on: boolean) => {
    if (!on) {
      dispatch({ type: 'settings/update', patch: { remindersEnabled: false } });
      return;
    }
    const granted = await requestNotificationPermission();
    dispatch({ type: 'settings/update', patch: { remindersEnabled: granted } });
    setPermissionNote(
      granted
        ? isNative()
          ? 'Reminders are on. Your phone will remind you even when Outagekit is closed.'
          : 'Reminders are on while Outagekit is open. Add the calendar reminder too, so you are reminded when it is closed.'
        : 'Notifications are blocked. Allow them in your phone or browser settings, or use the calendar reminder.',
    );
  };

  const addToCalendar = async () => {
    const source = state.sources[0];
    const start = source
      ? chargeReminder({ lastChargedAt: source.lastChargedAt, intervalDays: interval, now }).dueAt
      : now;
    if (start.getTime() < now.getTime()) start.setTime(now.getTime() + 86_400_000);
    start.setHours(10, 0, 0, 0);
    const names = state.sources.map((s) => s.name).join(' and ') || 'your battery';
    const ics = recurringReminderIcs({
      uid: `charge-${state.sources[0]?.uid ?? 'battery'}`,
      title: `Charge ${names}`,
      description:
        'Charge to full and check it turns on. Check medical device batteries and oxygen cylinders too. Reminder from Outagekit.',
      start,
      intervalDays: interval,
      now,
    });
    await saveFile('outagekit-charge-reminder.ics', ics, 'text/calendar');
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Keep it charged</h1>
        <p>
          A battery that sat in a closet for six months may be half empty when you need it. Top it
          up on a schedule, and run a short test now and then.
        </p>
      </header>

      <Section id="status" title="Your batteries">
        <ul className="card-list">
          {state.sources.map((source) => {
            const charge = currentCharge(source, now);
            const due = chargeReminder({
              lastChargedAt: source.lastChargedAt,
              intervalDays: interval,
              now,
            });
            const days = Math.round(due.daysUntilDue);
            return (
              <li
                key={source.uid}
                className={`card reminder ${due.overdue ? 'reminder-overdue' : ''}`}
              >
                <div className="reminder-main">
                  <Icon name="battery" size={28} />
                  <div>
                    <h3>{source.name}</h3>
                    <p>
                      Last charged {formatDate(source.lastChargedAt)} · probably about{' '}
                      <strong>{formatPercent(charge)}</strong> now
                    </p>
                    <p className={due.overdue ? 'due due-overdue' : 'due'}>
                      {due.overdue
                        ? `Charge it now: overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}.`
                        : `Next charge due ${formatDate(due.dueAt)} (${days} ${days === 1 ? 'day' : 'days'}).`}
                    </p>
                    <p className="hint">
                      For this battery type, check at least every{' '}
                      {recommendedCheckIntervalDays(source.chemistry)} days.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => dispatch({ type: 'source/charge', uid: source.uid, chargedTo: 1 })}
                >
                  <Icon name="check" size={18} /> Charged to full today
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="schedule" title="Reminders">
        <SelectField
          label="Remind me to charge"
          value={String(interval)}
          options={INTERVALS}
          onChange={(value) =>
            dispatch({ type: 'settings/update', patch: { reminderIntervalDays: Number(value) } })
          }
        />
        <div className="reminder-actions">
          {notificationsAvailable() && (
            <button
              type="button"
              className="button"
              onClick={() => void enable(!state.settings.remindersEnabled)}
            >
              <Icon name="bell" size={18} />{' '}
              {state.settings.remindersEnabled ? 'Turn off notifications' : 'Turn on notifications'}
            </button>
          )}
          <button type="button" className="button" onClick={() => void addToCalendar()}>
            <Icon name="calendar" size={18} /> Add to my calendar
          </button>
        </div>
        {permissionNote && <p className="callout">{permissionNote}</p>}
      </Section>

      <Section id="checklist" title="Every few months">
        <ul className="checklist">
          <li>
            Charge the power station to full, then run your main device from it for 10 minutes.
          </li>
          <li>Charge the internal and spare batteries in your ventilator, oxygen or CPAP.</li>
          <li>Check oxygen cylinders are full and the regulator and tubing are with them.</li>
          <li>Tell your electric utility that someone at home uses medical equipment.</li>
          <li>Print a fresh fridge card if anything changed.</li>
        </ul>
      </Section>
    </div>
  );
}
