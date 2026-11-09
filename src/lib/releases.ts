import type { CalEvent, NewsItem } from "./types";
import { ffBias, ffNum } from "./sources/calendar";
import { parseRelease, releaseCcy } from "./sources/news";

const STOP = new Set(["the", "and", "rate", "index", "change"]);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

export function applyReleases(events: CalEvent[], news: NewsItem[]): CalEvent[] {
  const rel = news.filter((n) => n.wire).map((n) => ({ n, p: parseRelease(n.title), c: releaseCcy(n.title) })).filter((x) => x.p && x.c);
  if (!rel.length) return events;
  return events.map((e) => {
    if (e.released) return e;
    const f = ffNum(e.forecast);
    if (f === null) return e;
    const t0 = Date.parse(e.date);
    const cands = rel.filter((x) => x.c === e.ccy && ffNum(x.p!.forecast) === f && Date.parse(x.n.time) >= t0 - 3600e3 && Date.parse(x.n.time) <= t0 + 6 * 3600e3);
    if (!cands.length) return e;
    const ew = words(e.title);
    const sc = cands.map((x) => ({ x, s: words(x.n.title).filter((w) => ew.includes(w)).length })).sort((a, b) => b.s - a.s);
    const best = sc[0];
    const sameActual = sc.every((y) => ffNum(y.x.p!.actual) === ffNum(best.x.p!.actual));
    if (!sameActual && (best.s === 0 || (sc[1] && sc[1].s === best.s))) return e;
    const actual = best.x.p!.actual;
    return { ...e, actual, released: true, bias: ffBias(e.title, actual, e.forecast), actualSrc: "FinancialJuice" };
  });
}