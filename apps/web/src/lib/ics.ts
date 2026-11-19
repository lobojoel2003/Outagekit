const pad = (n: number) => String(n).padStart(2, '0');

function icsDate(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function escape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, (m) => `\\${m}`);
}

/** Fold long lines at 75 octets as RFC 5545 requires. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export interface RecurringReminder {
  uid: string;
  title: string;
  description: string;
  start: Date;
  intervalDays: number;
  now?: Date;
}

/**
 * A calendar file with a repeating all-day-style reminder (one hour long) and
 * an alarm, so phones remind you to charge even without this app open.
 */
export function recurringReminderIcs(reminder: RecurringReminder): string {
  const end = new Date(reminder.start.getTime() + 3_600_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Outagekit//Charge reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${reminder.uid}@outagekit`,
    `DTSTAMP:${icsDate(reminder.now ?? new Date())}`,
    `DTSTART:${icsDate(reminder.start)}`,
    `DTEND:${icsDate(end)}`,
    `RRULE:FREQ=DAILY;INTERVAL=${Math.max(1, Math.round(reminder.intervalDays))}`,
    `SUMMARY:${escape(reminder.title)}`,
    `DESCRIPTION:${escape(reminder.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(reminder.title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
