/** Minimal date helpers — no external date library, per Rules.md (avoid unnecessary deps). */

export function parseISODate(value: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return d;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

export function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}
