
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import {
  CURRENCIES,
  type Bias,
  type CalEvent,
  type Ccy,
  type Health,
} from "../types";

import { cached, getText } from "../cache";

// Parse economic values safely, including percentages and decimals.
export function ffNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;

  const value = String(v).trim();

  if (/^(?:-|--|n\/a|na|pending|tentative)$/i.test(value)) {
    return null;
  }

  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);

  if (!match) return null;

  const number = Number(match[0]);

  return Number.isFinite(number) ? number : null;
}

export function ffPolarity(title: string): 1 | -1 {
  return /unemployment|jobless|claims|job cuts/i.test(title)
    ? -1
    : 1;
}

export function ffBias(
  title: string,
  actual: unknown,
  forecast: unknown
): Bias {
  const a = ffNum(actual);
  const f = ffNum(forecast);

  if (a === null || f === null) return "pending";

  const difference = a - f;

  if (Math.abs(difference) < 1e-12) return "neutral";

  return difference * ffPolarity(title) > 0
    ? "bullish"
    : "bearish";
}

type Raw = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string | number | null;
};

function cleanValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  const result = String(value).trim();

  if (
    !result ||
    /^(?:-|--|n\/a|na|pending|tentative)$/i.test(result)
  ) {
    return null;
  }

  return result;
}

export function toEvents(rows: Raw[]): CalEvent[] {
  const validCurrencies = new Set<string>(CURRENCIES);
  const events: CalEvent[] = [];

  for (const event of rows) {
    if (
      !event.country ||
      !validCurrencies.has(event.country) ||
      String(event.impact ?? "").toLowerCase() !== "high" ||
      !event.date ||
      !event.title
    ) {
      continue;
    }

    const timestamp = Date.parse(event.date);

    if (!Number.isFinite(timestamp)) continue;

    const actual = cleanValue(event.actual);
    const forecast = cleanValue(event.forecast);
    const previous = cleanValue(event.previous);

    const released = ffNum(actual) !== null;

    events.push({
      id: `${event.date}|${event.country}|${event.title}`,
      date: new Date(timestamp).toISOString(),
      ccy: event.country as Ccy,
      title: event.title.trim(),
      actual,
      forecast,
      previous,
      released,
      bias: ffBias(event.title, actual, forecast),
    });
  }

  return events.sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}

// Fallback storage for environments with writable temporary storage.
const CACHE_FILE = path.join(
  os.tmpdir(),
  "fx-calendar-cache.json"
);

const CALENDAR_URL =
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

async function loadWeek(): Promise<{
  rows: Raw[];
  fromDisk: boolean;
}> {
  try {
    const response = await getText(CALENDAR_URL);

    const parsed: unknown = JSON.parse(response);

    if (!Array.isArray(parsed)) {
      throw new Error("Invalid calendar response: expected an array");
    }

    const rows = parsed as Raw[];

    // Save a copy for temporary fallback.
    try {
      await fs.writeFile(
        CACHE_FILE,
        JSON.stringify(rows),
        "utf8"
      );
    } catch {
      // Live data remains usable even if disk storage fails.
    }

    return {
      rows,
      fromDisk: false,
    };
  } catch (error) {
    // Use the last saved copy if the live source fails.
    try {
      const saved = await fs.readFile(CACHE_FILE, "utf8");
      const rows = JSON.parse(saved) as Raw[];

      if (Array.isArray(rows) && rows.length > 0) {
        return {
          rows,
          fromDisk: true,
        };
      }
    } catch {
      // No usable fallback available.
    }

    throw error;
  }
}

export async function getCalendar(): Promise<{
  events: CalEvent[];
  health: Health;
}> {
  const result = await cached(
    "calendar",
    5 * 60 * 1000,
    async () => {
      const { rows, fromDisk } = await loadWeek();

      return {
        events: toEvents(rows),
        fromDisk,
      };
    }
  );

  const events = result.value?.events ?? [];

  return {
    events,
    health: {
      id: "calendar",
      label: "Red Folder calendar",
      ok: result.value !== null,
      stale: result.stale || !!result.value?.fromDisk,
      error: result.error,
      fetchedAt: result.fetchedAt,
      detail: result.value
        ? `${events.length} high-impact events`
        : undefined,
    },
  };
}
