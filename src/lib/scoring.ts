import { CURRENCIES, type CalEvent, type Ccy, type Factor, type NewsItem, type RateInfo, type Score } from "./types";

const clamp = (x: number, lo = -5, hi = 5) => Math.max(lo, Math.min(hi, x));
const sgn = (n: number) => (n > 0 ? "+" : "") + n.toFixed(2);

export const label = (s: number | null) =>
  s === null ? "No data" : s >= 3 ? "Strongly bullish" : s >= 1 ? "Bullish" : s > -1 ? "Neutral" : s > -3 ? "Bearish" : "Strongly bearish";

const W = { momentum: 0.35, carry: 0.25, surprise: 0.25, news: 0.15 };

export function scoreAll(rates: RateInfo[], events: CalEvent[], news: NewsItem[]): Score[] {
  const live = rates.filter((r) => r.rate !== null).map((r) => r.rate as number);
  const avg = live.length ? live.reduce((a, b) => a + b, 0) / live.length : null;
  const cutoff = Date.now() - 48 * 3600 * 1000;

  const out = CURRENCIES.map((ccy): Score => {
    const r = rates.find((x) => x.ccy === ccy);
    const f: Factor[] = [];

    f.push(r?.change6m != null
      ? { key: "momentum", label: "Policy momentum (6M)", weight: W.momentum, score: clamp(r.change6m * 4), note: `${sgn(r.change6m)} pp in ~6 months; each 25bp = 1 point` }
      : { key: "momentum", label: "Policy momentum (6M)", weight: W.momentum, score: null, note: "6-month rate history unavailable" });

    f.push(r?.rate != null && avg !== null
      ? { key: "carry", label: "Rate level vs G8 average", weight: W.carry, score: clamp((r.rate - avg) * 1.25), note: `${r.rate.toFixed(2)}% vs ${avg.toFixed(2)}% average of the 8 banks` }
      : { key: "carry", label: "Rate level vs G8 average", weight: W.carry, score: null, note: "policy rate unavailable" });

    const rel = events.filter((e) => e.ccy === ccy && e.released && (e.bias === "bullish" || e.bias === "bearish"));
    const bull = rel.filter((e) => e.bias === "bullish").length, bear = rel.length - bull;
    f.push(rel.length
      ? { key: "surprise", label: "Data surprises (Red Folder)", weight: W.surprise, score: clamp((bull - bear) * 1.5), note: `${bull} beat / ${bear} miss across ${rel.length} released high-impact events` }
      : { key: "surprise", label: "Data surprises (Red Folder)", weight: W.surprise, score: null, note: "no high-impact result released yet" });

    const tagged = news.filter((n) => n.ccy === ccy && Date.parse(n.time) >= cutoff && n.tone !== 0);
    f.push(tagged.length >= 2
      ? { key: "news", label: "News tone (48h)", weight: W.news, score: clamp((tagged.reduce((a, n) => a + n.tone, 0) / tagged.length) * 5), note: `${tagged.length} hawkish/dovish-tagged headlines` }
      : { key: "news", label: "News tone (48h)", weight: W.news, score: null, note: "too few tagged headlines" });

    const avail = f.filter((x) => x.score !== null);
    const wsum = avail.reduce((a, x) => a + x.weight, 0);
    const total = wsum ? +(avail.reduce((a, x) => a + (x.score as number) * x.weight, 0) / wsum).toFixed(1) : null;
    return { ccy, total, label: label(total), coverage: +wsum.toFixed(2), factors: f };
  });
  return out.sort((a, b) => (b.total ?? -99) - (a.total ?? -99));
}
