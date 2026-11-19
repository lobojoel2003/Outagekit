import { chargeReminder, formatDuration } from '@outagekit/runtime';
import type { AppState } from '../state/types';
import type { Computed } from './compute';
import { formatClock } from './format';
import { isNative } from './platform';

/** Notification ids: 1000+ for charge reminders, 2000+ for outage alerts. */
const CHARGE_BASE = 1000;
const OUTAGE_BASE = 2000;
const REMINDER_REPEATS = 6;

export interface PlannedNotification {
  id: number;
  title: string;
  body: string;
  at: Date;
}

/** Charge reminders for each battery: the next due date and a few after it. */
export function plannedChargeReminders(state: AppState, now: Date): PlannedNotification[] {
  if (!state.settings.remindersEnabled) return [];
  const interval = state.settings.reminderIntervalDays;
  const planned: PlannedNotification[] = [];
  state.sources.forEach((source, sourceIndex) => {
    const { dueAt } = chargeReminder({
      lastChargedAt: source.lastChargedAt,
      intervalDays: interval,
      now,
    });
    // An overdue reminder fires in a minute; later ones follow the interval.
    let at = dueAt.getTime() < now.getTime() ? new Date(now.getTime() + 60_000) : dueAt;
    for (let i = 0; i < REMINDER_REPEATS; i++) {
      planned.push({
        id: CHARGE_BASE + sourceIndex * REMINDER_REPEATS + i,
        title: `Charge ${source.name}`,
        body: 'Top it up to full and check it turns on, so it is ready for the next outage.',
        at,
      });
      at = new Date(at.getTime() + interval * 86_400_000);
    }
  });
  return planned;
}

/** Alerts during an outage: time to leave, one hour left, and empty. */
export function plannedOutageAlerts(
  state: AppState,
  computed: Computed,
  now: Date,
): PlannedNotification[] {
  if (!state.outage || !computed.endsAt) return [];
  const planned: PlannedNotification[] = [];
  const place = state.profile.destinations[0]?.name || 'somewhere with power';
  if (computed.leaveAt && computed.leaveAt.getTime() > now.getTime()) {
    planned.push({
      id: OUTAGE_BASE,
      title: 'Time to leave',
      body: `Leave now for ${place}. About ${formatDuration(computed.hours - (computed.leaveAt.getTime() - now.getTime()) / 3_600_000)} of battery left.`,
      at: computed.leaveAt,
    });
  }
  const hourBefore = new Date(computed.endsAt.getTime() - 3_600_000);
  if (hourBefore.getTime() > now.getTime()) {
    planned.push({
      id: OUTAGE_BASE + 1,
      title: 'One hour of battery left',
      body: `The battery is expected to run out at ${formatClock(computed.endsAt, now)}. Get backup ready now.`,
      at: hourBefore,
    });
  }
  if (computed.endsAt.getTime() > now.getTime()) {
    planned.push({
      id: OUTAGE_BASE + 2,
      title: 'Battery may be empty',
      body: 'Switch to backup oxygen or batteries now. Call 911 if anyone has trouble breathing.',
      at: computed.endsAt,
    });
  }
  return planned;
}

export function notificationsAvailable(): boolean {
  return isNative() || (typeof window !== 'undefined' && 'Notification' in window);
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    }
    if (!('Notification' in window)) return false;
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

const webTimers: ReturnType<typeof setTimeout>[] = [];

async function showWebNotification(item: PlannedNotification): Promise<void> {
  const options: NotificationOptions = {
    body: item.body,
    tag: `outagekit-${item.id}`,
    icon: 'pwa-192.png',
  };
  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration) await registration.showNotification(item.title, options);
  else new Notification(item.title, options);
}

/**
 * Bring scheduled notifications in line with the current state. On Android
 * they are scheduled with the system; in a browser they fire while the app
 * is open (the calendar file covers the rest).
 */
export async function syncNotifications(
  state: AppState,
  computed: Computed,
  now: Date,
): Promise<void> {
  const planned = [
    ...plannedChargeReminders(state, now),
    ...plannedOutageAlerts(state, computed, now),
  ];
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') return;
      const pending = await LocalNotifications.getPending();
      const ours = pending.notifications.filter(
        (n) => n.id >= CHARGE_BASE && n.id < OUTAGE_BASE + 100,
      );
      if (ours.length)
        await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
      if (planned.length) {
        await LocalNotifications.schedule({
          notifications: planned.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            schedule: { at: item.at, allowWhileIdle: true },
          })),
        });
      }
      return;
    }
    while (webTimers.length) clearTimeout(webTimers.pop());
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    for (const item of planned) {
      const delay = item.at.getTime() - Date.now();
      // Browsers cap timers at about 24.8 days; longer reminders come from the calendar file.
      if (delay > 0 && delay < 2_147_000_000) {
        webTimers.push(setTimeout(() => void showWebNotification(item), delay));
      }
    }
  } catch {
    // Notifications are a convenience; the plan works without them.
  }
}
