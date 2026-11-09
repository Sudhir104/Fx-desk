import { CURRENCIES, type Ccy, type Health, type NewsItem } from "../types";
import { cached, getText } from "../cache";

const HAWK = ["rate hike", "raise rates", "raises rates", "hike", "tighten", "hawkish", "restrictive", "higher for longer", "inflation remains elevated", "inflation above", "upside risks", "stronger than expected", "beats", "strong jobs", "wage growth", "sticky", "hikes", "raises", "rate rise", "hotter", "above expectations", "accelerat", "higher rates", "tightening", "beat", "strong"];
const DOVE = ["rate cut", "cuts rates", "cut rates", "lower rates", "easing", "ease policy", "dovish", "accommodative", "downside risks", "inflation falls", "inflation eased", "slowdown", "recession", "weaker than expected", "misses", "job losses", "unemployment rises", "cooling", "pause", "rate cuts", "cuts", "lowers", "cools", "cooler", "below expectations", "contraction", "slows", "falls", "weak", "jobless rate rises", "dovish tilt"];
const TAGS: Record<Ccy, RegExp> = {
  USD: /\b(federal reserve|the fed\b|fed's|fomc|powell|waller|treasury|u\.s\.|us dollar|nfp|wall street)\b/,
  EUR: /\b(ecb|lagarde|eurozone|euro area|bund|euro\b|german)\b/,
  GBP: /\b(bank of england|boe\b|bailey|sterling|gilt|u\.k\.|uk cpi|british)\b/,
  JPY: /\b(bank of japan|boj\b|ueda|yen\b|japan)\b/,
  CHF: /\b(snb\b|swiss|schlegel)\b/,
  AUD: /\b(rba\b|reserve bank of australia|australia|aussie|bullock)\b/,
  NZD: /\b(rbnz|new zealand|kiwi|orr)\b/,
  CAD: /\b(bank of canada|boc\b|macklem|canad|loonie)\b/,
};

export function tone(text: string): number {
  const t = text.toLowerCase();
  const h = HAWK.filter((w) => t.includes(w)).length, d = DOVE.filter((w) => t.includes(w)).length;
  return h + d === 0 ? 0 : +((h - d) / (h + d)).toFixed(2);
}
export function tagCcy(text: string): Ccy | null {
  const t = text.toLowerCase();
  const hits = CURRENCIES.filter((c) => TAGS[c].test(t));
  return hits.length === 1 ? hits[0] : hits.length > 1 ? hits[0] : null;
}

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const tagText = (block: string, tag: string) => { const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i")); return m ? decode(m[1]) : ""; };


const NUM = String.raw`-?\d[\d,]*(?:\.\d+)?\s?(?:%|[KMBT])?`;
const REL = new RegExp(`(${NUM})\\s*(?:VS\\.?|V\\.?|VERSUS)\\s*(${NUM})\\s*(?:EXP(?:ECTED|ECTATIONS)?|EST(?:IMATES?|IMATED)?|FORECAST|CONS(?:ENSUS)?)`, "i");
export function parseRelease(title: string): { actual: string; forecast: string } | null {
  const m = title.match(REL);
  if (m) return { actual: m[1].replace(/\s+/g, ""), forecast: m[2].replace(/\s+/g, "") };
  const a = title.match(new RegExp(`Actual\\s+(${NUM})\\s*\\(\\s*Forecast\\s+(${NUM})`, "i"));
  return a ? { actual: a[1].replace(/\s+/g, ""), forecast: a[2].replace(/\s+/g, "") } : null;
}
const REL_CCY: [RegExp, Ccy][] = [
  [/\bNEW ZEALAND\b|\bNZ\b/, "NZD"],
  [/\bAUSTRALIA(N)?\b/, "AUD"],
  [/\bCANAD(A|IAN)\b/, "CAD"],
  [/\bSWISS\b|\bSWITZERLAND\b/, "CHF"],
  [/\bJAPAN(ESE)?\b/, "JPY"],
  [/\bUK\b|\bBRITAIN\b|\bBRITISH\b|\bUNITED KINGDOM\b/, "GBP"],
  [/\bEU\b|\bEURO\b|\bEURO AREA\b|\bEUROZONE\b|\bEURO ZONE\b|\bGERMAN(Y)?\b|\bFRANCE\b|\bFRENCH\b|\bITALY\b|\bSPAIN\b/, "EUR"],
  [/\bUS\b|\bU\.S\.\b|\bUNITED STATES\b|\bAMERICAN\b/, "USD"],
];
export function releaseCcy(title: string): Ccy | null {
  const t = title.toUpperCase();
  for (const [re, c] of REL_CCY) if (re.test(t)) return c;
  return null;
}

export type RawItem = { title: string; link: string; time: string };
/** Minimal RSS 2.0 / Atom parser (no dependency) */
export function parseRss(xml: string): RawItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const out: RawItem[] = [];
  for (const b of blocks) {
    const title = tagText(b, "title");
    let link = tagText(b, "link");
    if (!link) link = b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "";
    const when = tagText(b, "pubDate") || tagText(b, "published") || tagText(b, "updated") || tagText(b, "dc:date");
    const t = new Date(when);
    if (!title || !link || Number.isNaN(t.getTime())) continue;
    out.push({ title, link, time: t.toISOString() });
  }
  return out;
}

type Feed = { id: string; label: string; url: string; ccy?: Ccy; wire?: boolean };
const FEEDS: Feed[] = [
  { id: "fj", label: "FinancialJuice", url: "https://www.financialjuice.com/feed.ashx?xy=rss", wire: true },
  { id: "fed", label: "Federal Reserve", url: "https://www.federalreserve.gov/feeds/press_all.xml", ccy: "USD" },
  { id: "ecb", label: "ECB", url: "https://www.ecb.europa.eu/rss/press.html", ccy: "EUR" },
  { id: "boe", label: "Bank of England", url: "https://www.bankofengland.co.uk/rss/news", ccy: "GBP" },
  { id: "boj", label: "Bank of Japan", url: "https://www.boj.or.jp/en/rss/whatsnew.xml", ccy: "JPY" },
  { id: "snb", label: "SNB", url: "https://www.snb.ch/public/en/rss/pressrel", ccy: "CHF" },
  { id: "rba", label: "RBA", url: "https://www.rba.gov.au/rss/rss-cb-media-releases.xml", ccy: "AUD" },
  { id: "boc", label: "Bank of Canada", url: "https://www.bankofcanada.ca/content_type/press-releases/feed/", ccy: "CAD" },
];

async function loadFeed(f: Feed): Promise<NewsItem[]> {
  const xml = await getText(f.url, { headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" } });
  const items = parseRss(xml);
  if (!items.length) throw new Error("feed parsed to zero items");
  return items.slice(0, f.wire ? 150 : 40).map((it) => {
    const title = it.title.replace(/^financialjuice\s*[:\-–]\s*/i, "");
    return { id: f.id + "|" + it.link, title, link: it.link, time: it.time, source: f.label, wire: !!f.wire, ccy: f.ccy ?? tagCcy(title), tone: tone(title) };
  });
}

export async function getNews(): Promise<{ news: NewsItem[]; health: Health[] }> {
  const results = await Promise.all(FEEDS.map(async (f) => ({ f, r: await cached("news:" + f.id, 5 * 60 * 1000, () => loadFeed(f)) })));
  const all: NewsItem[] = [];
  const seen = new Set<string>();
  for (const { r } of results) for (const n of r.value ?? []) {
    const k = n.title.toLowerCase().slice(0, 80);
    if (!seen.has(k)) { seen.add(k); all.push(n); }
  }
  all.sort((a, b) => b.time.localeCompare(a.time));
  const fj = results.find((x) => x.f.id === "fj")!.r;
  const official = results.filter((x) => x.f.id !== "fj");
  const okOfficial = official.filter((x) => x.r.value).length;
  return {
    news: all.slice(0, 220),
    health: [
      { id: "fj", label: "FinancialJuice", ok: fj.value !== null, stale: fj.stale, error: fj.error, fetchedAt: fj.fetchedAt, detail: fj.value ? `${fj.value.length} headlines` : undefined },
      { id: "news", label: "Central-bank news", ok: okOfficial >= 4, stale: official.some((x) => x.r.stale), error: official.filter((x) => !x.r.value).map((x) => `${x.f.label}: ${x.r.error}`).join(" | ") || undefined, fetchedAt: official.find((x) => x.r.fetchedAt)?.r.fetchedAt, detail: `${okOfficial}/${official.length} feeds` },
    ],
  };
}
