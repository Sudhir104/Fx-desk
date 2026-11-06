import { BANKS, CURRENCIES, type Ccy, type Health, type RateInfo } from "../types";
import { cached, getText, isoDaysAgo } from "../cache";

export type Point = { date: string; value: number };

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const c = splitCsvLine(l);
    const o: Record<string, string> = {};
    head.forEach((h, i) => (o[h] = (c[i] ?? "").trim()));
    return o;
  });
}

const pick = (row: Record<string, string>, prefix: string) => {
  const k = Object.keys(row).find((x) => x.toUpperCase().startsWith(prefix));
  return k ? row[k] : "";
};
export function normDate(p: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  if (/^\d{4}-\d{2}$/.test(p)) return p + "-01";
  return null;
}

/** BIS SDMX CSV -> { areaCode: points[] } (handles both "US" and "US: United States" cell styles) */
export function parseBisCsv(text: string): Record<string, Point[]> {
  const out: Record<string, Point[]> = {};
  for (const row of parseCsv(text)) {
    const area = pick(row, "REF_AREA").split(":")[0].trim();
    const date = normDate(pick(row, "TIME_PERIOD").trim());
    const value = parseFloat(pick(row, "OBS_VALUE"));
    if (!area || !date || Number.isNaN(value)) continue;
    (out[area] ||= []).push({ date, value });
  }
  for (const a of Object.keys(out)) out[a].sort((x, y) => x.date.localeCompare(y.date));
  return out;
}

const shift = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
const valueAtOrBefore = (s: Point[], iso: string) => { let v: number | null = null; for (const p of s) { if (p.date <= iso) v = p.value; else break; } return v; };

export function deriveRate(ccy: Ccy, s: Point[], source: string): RateInfo {
  if (!s.length) return { ccy, rate: null, asOf: null, change6m: null, change12m: null, lastMoveDate: null, lastMoveSize: null, source };
  const last = s[s.length - 1];
  const covers = (days: number) => s[0].date <= shift(last.date, -days);
  const v6 = covers(182) ? valueAtOrBefore(s, shift(last.date, -182)) : null;
  const v12 = covers(365) ? valueAtOrBefore(s, shift(last.date, -365)) : null;
  let i = s.length - 2;
  while (i >= 0 && Math.abs(s[i].value - last.value) < 1e-9) i--;
  const moved = i >= 0;
  return {
    ccy, rate: last.value, asOf: last.date,
    change6m: v6 === null ? null : +(last.value - v6).toFixed(2),
    change12m: v12 === null ? null : +(last.value - v12).toFixed(2),
    lastMoveDate: moved ? s[i + 1].date : null,
    lastMoveSize: moved ? +(last.value - s[i].value).toFixed(2) : null,
    source,
  };
}

async function fromBis(): Promise<{ series: Record<string, Point[]>; variant: string }> {
  const start = isoDaysAgo(430);
  const areas = CURRENCIES.map((c) => BANKS[c].bis).join("+");
  const variants: [string, string][] = [];
  for (const f of ["D", "M"]) {
    variants.push([`v1/${f}/all`, `https://stats.bis.org/api/v1/data/WS_CBPOL/${f}.${areas}/all?startPeriod=${start}&format=csv`]);
    variants.push([`v1/${f}`, `https://stats.bis.org/api/v1/data/WS_CBPOL/${f}.${areas}?startPeriod=${start}&format=csv`]);
    variants.push([`v2/${f}`, `https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/${f}.${areas}?startPeriod=${start}&format=csv`]);
  }
  const errs: string[] = [];
  for (const [name, url] of variants) {
    try {
      const series = parseBisCsv(await getText(url, { timeout: 12000 }));
      if (Object.keys(series).length >= 4) return { series, variant: name };
      errs.push(`${name}: too few rows`);
    } catch (e) { errs.push(`${name}: ${e instanceof Error ? e.message : e}`); }
  }
  throw new Error("BIS unreachable (" + errs.slice(0, 3).join("; ") + ")");
}

async function ecbEur(): Promise<Point[]> {
  const t = await getText(`https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.4F.KR.DFR.LEV?startPeriod=${isoDaysAgo(430)}&format=csvdata`);
  return parseCsv(t).map((r) => ({ date: normDate(r["TIME_PERIOD"] ?? "") ?? "", value: parseFloat(r["OBS_VALUE"]) })).filter((p) => p.date && !Number.isNaN(p.value)).sort((a, b) => a.date.localeCompare(b.date));
}
async function bocCad(): Promise<Point[]> {
  const j = JSON.parse(await getText(`https://www.bankofcanada.ca/valet/observations/V39079/json?start_date=${isoDaysAgo(430)}`));
  return (j.observations ?? []).map((o: { d: string; V39079?: { v: string } }) => ({ date: o.d, value: parseFloat(o.V39079?.v ?? "NaN") })).filter((p: Point) => !Number.isNaN(p.value));
}
async function fredUsd(): Promise<Point[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY not set");
  const j = JSON.parse(await getText(`https://api.stlouisfed.org/fred/series/observations?series_id=DFEDTARU&api_key=${key}&file_type=json&observation_start=${isoDaysAgo(430)}`));
  return (j.observations ?? []).map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) })).filter((p: Point) => !Number.isNaN(p.value));
}

export async function getRates(): Promise<{ rates: RateInfo[]; health: Health }> {
  const r = await cached("rates", 30 * 60 * 1000, async () => {
    const series: Partial<Record<Ccy, { pts: Point[]; src: string }>> = {};
    let variant = "";
    let bisErr = "";
    try {
      const b = await fromBis();
      variant = b.variant;
      for (const c of CURRENCIES) { const pts = b.series[BANKS[c].bis]; if (pts?.length) series[c] = { pts, src: "BIS" }; }
    } catch (e) { bisErr = e instanceof Error ? e.message : String(e); }
    const fb: [Ccy, () => Promise<Point[]>, string][] = [["EUR", ecbEur, "ECB"], ["CAD", bocCad, "Bank of Canada"], ["USD", fredUsd, "FRED"]];
    for (const [c, fn, src] of fb) {
      if (series[c]) continue;
      try { const pts = await fn(); if (pts.length) series[c] = { pts, src }; } catch { /* leave missing */ }
    }
    if (!Object.keys(series).length) throw new Error(bisErr || "no rate source reachable");
    return { rates: CURRENCIES.map((c) => deriveRate(c, series[c]?.pts ?? [], series[c]?.src ?? "—")), variant, bisErr };
  });
  const have = r.value?.rates.filter((x) => x.rate !== null).length ?? 0;
  return {
    rates: r.value?.rates ?? CURRENCIES.map((c) => deriveRate(c, [], "—")),
    health: {
      id: "rates", label: "Policy rates", ok: have >= 6, stale: r.stale, error: r.error ?? (have < 8 ? r.value?.bisErr : undefined),
      fetchedAt: r.fetchedAt, detail: r.value ? `${have}/8 banks · ${r.value.variant || "fallback sources"}` : undefined,
    },
  };
}
