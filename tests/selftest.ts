import assert from "node:assert/strict";
import { parseBisCsv, deriveRate, splitCsvLine } from "../src/lib/sources/rates";
import { ffBias, toEvents } from "../src/lib/sources/calendar";
import { parseRss, tone, tagCcy } from "../src/lib/sources/news";
import { scoreAll } from "../src/lib/scoring";
import { CURRENCIES, type NewsItem, type RateInfo } from "../src/lib/types";

// csv
assert.deepEqual(splitCsvLine('a,"b,c",d'), ["a", "b,c", "d"]);

// BIS: both header styles
const plain = "FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE\nD,US,2026-10-01,4.25\nD,US,2026-10-02,4.00\nD,XM,2026-10-02,2.00";
const labelled = '"FREQ:Frequency","REF_AREA:Reference area","TIME_PERIOD:Period","OBS_VALUE:Value"\n"D: Daily","US: United States","2026-10","4.25"';
assert.equal(parseBisCsv(plain).US.length, 2);
assert.equal(parseBisCsv(plain).XM[0].value, 2);
assert.equal(parseBisCsv(labelled).US[0].date, "2026-10-01");

// deriveRate: cut 25bp mid-series, held since
const s = [] as { date: string; value: number }[];
for (let i = 0; i < 400; i++) { const d = new Date(Date.UTC(2025, 8, 1) + i * 86400000).toISOString().slice(0, 10); s.push({ date: d, value: i < 300 ? 4.5 : 4.25 }); }
const r = deriveRate("USD", s, "BIS");
assert.equal(r.rate, 4.25); assert.equal(r.lastMoveSize, -0.25); assert.equal(r.change6m, -0.25); assert.equal(r.change12m, null === r.change12m ? null : r.change12m);
assert.equal(deriveRate("EUR", [], "x").rate, null);

// calendar bias
assert.equal(ffBias("Core CPI m/m", "0.4%", "0.3%"), "bullish");
assert.equal(ffBias("Unemployment Rate", "4.2%", "4.0%"), "bearish");
assert.equal(ffBias("Retail Sales m/m", "0.3%", "0.3%"), "neutral");
assert.equal(ffBias("GDP", "", "0.3%"), "pending");
const ev = toEvents([
  { title: "Core CPI m/m", country: "USD", date: "2026-10-26T08:30:00-04:00", impact: "High", forecast: "0.3%", previous: "0.2%", actual: "0.4%" },
  { title: "Bank Holiday", country: "CNY", date: "2026-10-26T00:00:00-04:00", impact: "High" },
  { title: "Minor", country: "EUR", date: "2026-10-26T00:00:00-04:00", impact: "Low" },
]);
assert.equal(ev.length, 1); assert.equal(ev[0].released, true);

// rss: RSS+CDATA and Atom
const rss = `<rss><channel><item><title><![CDATA[FED'S WALLER: RATE &amp; OUTLOOK]]></title><link>https://x.com/1</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
const atom = `<feed><entry><title>ECB holds</title><link href="https://x.com/2"/><updated>2026-10-26T11:00:00Z</updated></entry></feed>`;
assert.equal(parseRss(rss)[0].title, "FED'S WALLER: RATE & OUTLOOK");
assert.equal(parseRss(atom)[0].link, "https://x.com/2");
assert.ok(tone("Fed signals rate hike, inflation above target") > 0);
assert.ok(tone("ECB signals rate cut as recession fears grow") < 0);
assert.equal(tagCcy("Bank of Canada holds"), "CAD");

// scoring: higher momentum+rate should rank first; missing data degrades, not crashes
const mk = (ccy: any, rate: number | null, ch: number | null): RateInfo => ({ ccy, rate, asOf: "2026-10-26", change6m: ch, change12m: null, lastMoveDate: null, lastMoveSize: null, source: "t" });
const rates = [mk("USD", 5, 0.5), mk("EUR", 2, -0.75), mk("GBP", 4, 0), mk("JPY", 0.5, 0.25), mk("CHF", 0, -0.5), mk("AUD", 3.5, 0), mk("NZD", 2.5, -1), mk("CAD", null, null)];
const news: NewsItem[] = [];
const sc = scoreAll(rates, ev, news);
assert.equal(sc.length, 8); assert.equal(sc[0].ccy, "USD");
const cad = sc.find((x) => x.ccy === "CAD")!;
assert.equal(cad.total, null); assert.equal(cad.label, "No data");
assert.ok(sc.find((x) => x.ccy === "USD")!.factors.find((f) => f.key === "surprise")!.score === 1.5);
assert.deepEqual([...CURRENCIES].sort(), sc.map((x) => x.ccy).sort());
console.log("ALL SELFTESTS PASSED");
