/**
 * Spécifications `k3-countdown` — compte à rebours M3.
 */

export type CountdownTimeData = {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
};

export const CountdownSpecs = {
  defaultTime: 0,
  defaultFormat: 'HH : mm : ss',
  defaultEndMessage: "Time's up",
  defaultAutoStart: true,
  defaultShortLabels: false,
  daysPerMonth: 30,
  accessibility: {
    role: 'timer' as const,
    live: 'polite' as const,
    ariaLabel: 'Countdown',
  },
  unitLabels: {
    MM: { one: 'month', other: 'months' },
    DD: { one: 'day', other: 'days' },
    HH: { one: 'hour', other: 'hours' },
    mm: { one: 'minute', other: 'minutes' },
    ss: { one: 'second', other: 'seconds' },
  },
  unitLabelsShort: {
    MM: 'mo',
    DD: 'd',
    HH: 'h',
    mm: 'm',
    ss: 's',
  },
} as const;

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** Pad numeric string to fixed width. */
export function padCountdownUnit(str: string, length: number, pad = '0'): string {
  if (str.length >= length) return str;
  return pad.repeat(length - str.length) + str;
}

/** Split remaining ms into countdown units (30-day months). */
export function msToCountdownTime(durationMs: number): CountdownTimeData {
  const ms = Math.max(0, durationMs);
  const totalDays = Math.floor(ms / DAY_MS);
  const months = Math.floor(totalDays / CountdownSpecs.daysPerMonth);
  const days = totalDays % CountdownSpecs.daysPerMonth;
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((ms % MINUTE_MS) / SECOND_MS);
  const milliseconds = Math.floor(ms % SECOND_MS);
  return { months, days, hours, minutes, seconds, milliseconds };
}

/** Replace format tokens (MM, DD, HH, mm, ss) with padded values. */
export function formatCountdownTime(format: string, time: CountdownTimeData): string {
  const scannedTimes = [
    time.months,
    time.days,
    time.hours,
    time.minutes,
    time.seconds,
    time.milliseconds,
  ];
  const scannedFormats = ['MM', 'DD', 'HH', 'mm', 'ss'];
  const padValues = [CountdownSpecs.daysPerMonth, 24, 60, 60, 1000];
  let result = format;

  scannedFormats.forEach((token, index) => {
    if (!result.includes(token)) {
      scannedTimes[index + 1] += scannedTimes[index] * padValues[index];
    } else {
      const value = padCountdownUnit(String(scannedTimes[index]), 2, '0');
      const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(re, value);
    }
  });

  if (result.includes('S')) {
    const ms = padCountdownUnit(String(scannedTimes[5]), 3, '0');
    if (result.includes('SSS')) result = result.replace(/SSS/g, ms);
    else if (result.includes('SS')) result = result.replace(/SS/g, ms.slice(0, 2));
    else result = result.replace(/S/g, ms.slice(0, 1));
  }
  return result;
}

/** Parse format into unit tokens and separator literals. */
export function parseCountdownFormat(format: string): Array<{ kind: 'unit'; unit: string } | { kind: 'sep'; text: string }> {
  const parts = format.split(/(MM|DD|HH|mm|ss)/g);
  const units = new Set(['MM', 'DD', 'HH', 'mm', 'ss']);
  const out: Array<{ kind: 'unit'; unit: string } | { kind: 'sep'; text: string }> = [];
  for (const part of parts) {
    if (units.has(part)) out.push({ kind: 'unit', unit: part });
    else if (part.length > 0) out.push({ kind: 'sep', text: part });
  }
  return out;
}

export function getSegmentValue(unit: string, timeData: CountdownTimeData): number {
  if (unit === 'mm') return timeData.minutes;
  if (unit === 'ss') return timeData.seconds;
  if (unit === 'MM') return timeData.months;
  if (unit === 'DD') return timeData.days;
  if (unit === 'HH') return timeData.hours;
  const upper = unit.toUpperCase();
  if (upper === 'MM') return timeData.months;
  if (upper === 'DD') return timeData.days;
  if (upper === 'HH') return timeData.hours;
  return timeData.seconds;
}
