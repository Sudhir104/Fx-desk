
import { promises as fs } from "fs";
import os from "os";
import path from "path";import { CURRENCIES, type Bias, type CalEvent, type Ccy, type Health } from "../types";
import { cached, getText } from "../cache";

export function ffNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const m = String(v).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
export function ffPolarity(title: string): 1 | -1 {
  return /unemployment|jobless|claims|job cuts/i.test(title) ? -1 : 1;
}
export function ffBias(title: string, actual: unknown, forecast: unknown): Bias {
  const a = ffNum(actual), f = ffNum(forecast);
  if (a === null || f === null) return "pending";
  const d = a - f;
  if (Math.abs(d) < 1e-12) return "neutral";
  return d * ffPolarity(title) > 0 ? "bullish" : "bearish";
}

type Raw = { title?: string; country?: string; date?: string; impact?: string; forecast?: string; previous?: string; actual?: string };
export function toEvents(rows: Raw[]): CalEvent[] {
  const set = new Set<string>(CURRENCIES);
  const out: CalEvent[] = [];
  for (const e of rows) {
    if (!e.country || !set.has(e.country) || String(e.impact ?? "").toLowerCase() !== "high" || !e.date || !e.title) continue;
    const actual = e.actual?.trim() || null;
    out.push({
      id: `${e.date}|${e.country}|${e.title}`, date: new Date(e.date).toISOString(), ccy: e.country as Ccy, title: e.title,
      actual, forecast: e.forecast?.trim() || null, previous: e.previous?.trim() || null,
      released: ffNum(actual) !== null, bias: ffBias(e.title, actual, e.forecast),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const CACHE_FILE = path.join(os.tmpdir(), "fx-calendar-cache.json");

async function loadWeek(): Promise<{ rows: Raw[]; fromDisk: boolean }> {
  try {
    const rows = JSON.parse(await getText("https://nfs.faireconomy.media/ff_calendar_thisweek.json")) as Raw[];
    fs.writeFile(CACHE_FILE, JSON.stringify(rows)).catch(() => {});
    return { rows, fromDisk: false };
  } catch (e) {
    try {
      const rows = JSON.parse(await fs.readFile(CACHE_FILE, "utf8")) as Raw[];
      if (rows.length) return { rows, fromDisk: true };
    } catch { /* no saved copy yet */ }
    throw e;
  }
}

export async function getCalendar(): Promise<{ events: CalEvent[]; health: Health }> {
  const r = await cached("calendar", 30 * 60 * 1000, async () => {
    const { rows, fromDisk } = await loadWeek();
    return { events: toEvents(rows), fromDisk };
  });
  const events = r.value?.events ?? [];
  return {
    events,
    health: { id: "calendar", label: "Red Folder calendar", ok: r.value !== null, stale: r.stale || !!r.value?.fromDisk, error: r.error, fetchedAt: r.fetchedAt, detail: r.value ? `${events.length} high-impact events` : undefined },
  };
}