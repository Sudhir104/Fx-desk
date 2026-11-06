"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BANKS, CURRENCIES, type Ccy, type Dashboard as D, type Health, type Score } from "@/lib/types";

type Note = { text: string; source: "ai" | "rules"; model?: string; generatedAt: string };

const ist = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const sg = (n: number | null, d = 2) => (n === null ? "—" : (n > 0 ? "+" : "") + n.toFixed(d));
const tone = (s: number | null) => (s === null ? "text-muted" : s >= 1 ? "text-bull" : s <= -1 ? "text-bear" : "text-amber");
const fill = (s: number) => (s >= 1 ? "bg-bull" : s <= -1 ? "bg-bear" : "bg-amber");

function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-line bg-panel shadow-[0_1px_0_rgba(17,24,39,.04)] ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

function Bar({ score, h = "h-1.5" }: { score: number | null; h?: string }) {
  if (score === null) return <div className={`${h} w-full rounded-full bg-soft`} />;
  const w = Math.min(50, Math.abs(score) * 10);
  return (
    <div className={`relative ${h} w-full rounded-full bg-soft`}>
      <div className="absolute left-1/2 top-[-2px] h-[calc(100%+4px)] w-px bg-line" />
      <div className={`absolute top-0 h-full rounded-full ${fill(score)}`} style={score >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
    </div>
  );
}

function Pill({ h }: { h: Health }) {
  const c = !h.ok ? "bg-bear" : h.stale ? "bg-amber" : "bg-bull";
  return (
    <span title={[h.detail, h.error, h.fetchedAt && "updated " + ist(h.fetchedAt)].filter(Boolean).join(" · ")} className="inline-flex items-center gap-1.5 rounded border border-line bg-soft px-2 py-1 text-[11px] text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
      <span className="font-medium text-ink">{h.label}</span>
      <span>{!h.ok ? "unavailable" : h.stale ? "stale" : h.detail ?? "live"}</span>
    </span>
  );
}

export default function Dashboard({ initial }: { initial: D | null }) {
  const [d, setD] = useState<D | null>(initial);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Ccy>("USD");
  const [calCcy, setCalCcy] = useState<Ccy | "ALL">("ALL");
  const [calTab, setCalTab] = useState<"all" | "released" | "upcoming">("all");
  const [newsFilter, setNewsFilter] = useState<"all" | "sel" | "wire">("all");
  const [base, setBase] = useState<Ccy>("AUD");
  const [quote, setQuote] = useState<Ccy>("CAD");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/dashboard", { cache: "no-store" });
      if (r.ok) setD(await r.json());
    } finally { setBusy(false); }
    fetch("/api/desk-note", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((n) => n && setNote(n)).catch(() => {});
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t); }, [load]);

  const scoreOf = (c: Ccy): Score | undefined => d?.scores.find((s) => s.ccy === c);
  const rateOf = (c: Ccy) => d?.rates.find((r) => r.ccy === c);
  const ladder = d?.scores ?? [];
  const selScore = scoreOf(sel);

  const events = useMemo(() => (d?.events ?? []).filter((e) => (calCcy === "ALL" || e.ccy === calCcy) && (calTab === "all" || (calTab === "released" ? e.released : !e.released))), [d, calCcy, calTab]);
  const news = useMemo(() => (d?.news ?? []).filter((n) => (newsFilter === "all" ? true : newsFilter === "sel" ? n.ccy === sel : n.wire)).slice(0, 30), [d, newsFilter, sel]);

  const pairDiff = (() => { const a = scoreOf(base)?.total, b = scoreOf(quote)?.total; return a == null || b == null ? null : +(a - b).toFixed(1); })();

  return (
    <div className="min-h-screen">
      <div className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="text-lg font-bold tracking-tight">FX Macro Desk</div>
            <div className="text-[12px] text-white/70">Central-bank policy, data surprises and wire news for the eight majors</div>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-white/80">
            <span className="num">{d ? "Updated " + ist(d.generatedAt) + " IST" : "Loading…"}</span>
            <button onClick={load} disabled={busy} className="rounded border border-white/30 px-3 py-1.5 font-medium text-white hover:bg-white/10 disabled:opacity-50">{busy ? "Refreshing…" : "Refresh"}</button>
          </div>
        </div>
      </div>
      <div className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2 px-5 py-2">
          <span className="text-[11px] font-medium text-muted">Data sources</span>
          {d ? d.health.map((h) => <Pill key={h.id} h={h} />) : <span className="text-[11px] text-muted">checking…</span>}
        </div>
      </div>

      <main className="mx-auto grid max-w-[1320px] gap-5 px-5 py-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Panel title="Central bank monitor" right={<span className="text-[11px] text-muted">click a row for the breakdown</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-muted">
                    <th className="px-4 py-2 font-medium">#</th><th className="py-2 font-medium">Currency</th>
                    <th className="py-2 text-right font-medium">Policy rate</th><th className="py-2 text-right font-medium">6M change</th>
                    <th className="py-2 pl-4 font-medium">Last move</th><th className="w-[180px] py-2 pl-4 font-medium">Fundamental bias</th><th className="px-4 py-2 text-right font-medium">Read</th>
                  </tr>
                </thead>
                <tbody>
                  {(ladder.length ? ladder : CURRENCIES.map((c) => ({ ccy: c, total: null, label: "Loading", coverage: 0, factors: [] }) as Score)).map((s, i) => {
                    const r = rateOf(s.ccy);
                    return (
                      <tr key={s.ccy} onClick={() => setSel(s.ccy)} className={`cursor-pointer border-b border-line/70 hover:bg-soft ${sel === s.ccy ? "bg-soft" : ""}`}>
                        <td className="num px-4 py-2.5 text-muted">{i + 1}</td>
                        <td className="py-2.5"><div className="font-semibold">{s.ccy}</div><div className="text-[11px] text-muted">{BANKS[s.ccy].bank}</div></td>
                        <td className="num py-2.5 text-right font-medium">{r?.rate != null ? r.rate.toFixed(2) + "%" : "—"}</td>
                        <td className={`num py-2.5 text-right ${r?.change6m ? (r.change6m > 0 ? "text-bull" : "text-bear") : "text-muted"}`}>{r?.change6m != null ? sg(r.change6m) + " pp" : "—"}</td>
                        <td className="num py-2.5 pl-4 text-[12px] text-muted">{r?.lastMoveDate ? `${sg(r.lastMoveSize)} · ${r.lastMoveDate}` : "—"}</td>
                        <td className="py-2.5 pl-4"><div className="flex items-center gap-2"><div className="flex-1"><Bar score={s.total} /></div><span className={`num w-10 text-right font-semibold ${tone(s.total)}`}>{s.total === null ? "—" : sg(s.total, 1)}</span></div></td>
                        <td className={`px-4 py-2.5 text-right text-[12px] font-medium ${tone(s.total)}`}>{s.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-4 py-2 text-[11px] text-muted">Policy rates: BIS central-bank dataset (daily) with ECB / Bank of Canada / FRED as fallbacks. Bias is a transparent model, not an official signal.</div>
          </Panel>

          <Panel title="Red Folder — high-impact calendar" right={<span className="text-[11px] text-muted">Forex Factory · IST</span>}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              {(["all", "released", "upcoming"] as const).map((t) => (
                <button key={t} onClick={() => setCalTab(t)} className={`rounded px-2.5 py-1 text-[12px] font-medium capitalize ${calTab === t ? "bg-navy text-white" : "text-muted hover:bg-soft"}`}>{t}</button>
              ))}
              <span className="mx-1 h-4 w-px bg-line" />
              {(["ALL", ...CURRENCIES] as const).map((c) => (
                <button key={c} onClick={() => setCalCcy(c)} className={`num rounded px-2 py-1 text-[11px] font-medium ${calCcy === c ? "bg-navy2 text-white" : "text-muted hover:bg-soft"}`}>{c}</button>
              ))}
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[700px] text-[13px]">
                <thead className="sticky top-0 bg-panel"><tr className="border-b border-line text-left text-[11px] text-muted">
                  <th className="px-4 py-2 font-medium">Time (IST)</th><th className="py-2 font-medium">Ccy</th><th className="py-2 font-medium">Event</th>
                  <th className="py-2 text-right font-medium">Actual</th><th className="py-2 text-right font-medium">Forecast</th><th className="py-2 text-right font-medium">Previous</th><th className="px-4 py-2 text-right font-medium">Result</th>
                </tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-line/70">
                      <td className="num whitespace-nowrap px-4 py-2 text-[12px] text-muted">{ist(e.date)}</td>
                      <td className="num py-2 font-semibold">{e.ccy}</td>
                      <td className="py-2">{e.title}</td>
                      <td className="num py-2 text-right font-medium">{e.actual ?? "—"}</td>
                      <td className="num py-2 text-right text-muted">{e.forecast ?? "—"}</td>
                      <td className="num py-2 text-right text-muted">{e.previous ?? "—"}</td>
                      <td className={`px-4 py-2 text-right text-[12px] font-medium capitalize ${e.bias === "bullish" ? "text-bull" : e.bias === "bearish" ? "text-bear" : "text-muted"}`}>{e.bias}</td>
                    </tr>
                  ))}
                  {!events.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-muted">{d ? "No events match this filter." : "Loading calendar…"}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-4 py-2 text-[11px] text-muted">Result compares actual with forecast (unemployment and claims are inverted). It is an estimate, not a Forex Factory signal.</div>
          </Panel>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <Panel title="Desk note" right={<span className="rounded bg-soft px-2 py-0.5 text-[10px] font-medium text-muted">{note ? (note.source === "ai" ? `AI · ${note.model}` : "rules-based") : "…"}</span>}>
            <div className="px-4 py-3 text-[13px] leading-relaxed text-ink">{note ? note.text : <span className="text-muted">Writing the note from the live figures…</span>}</div>
            <div className="border-t border-line px-4 py-2 text-[11px] text-muted">Generated only from the numbers on this page. Not trading advice.</div>
          </Panel>

          <Panel title={`${sel} breakdown`} right={<a href={BANKS[sel].url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-navy2 underline underline-offset-2">{BANKS[sel].bank} ↗</a>}>
            <div className="space-y-3.5 px-4 py-3">
              {selScore?.factors.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex items-baseline justify-between text-[12px]"><span className="font-medium">{f.label}</span><span className={`num font-semibold ${tone(f.score)}`}>{f.score === null ? "no data" : sg(f.score, 1)}</span></div>
                  <Bar score={f.score} />
                  <div className="mt-1 text-[11px] text-muted">{f.note}</div>
                </div>
              )) ?? <div className="text-[13px] text-muted">Loading…</div>}
              {selScore && <div className="border-t border-line pt-2 text-[11px] text-muted">Factor coverage {Math.round(selScore.coverage * 100)}% — missing factors are excluded and the rest re-weighted.</div>}
            </div>
          </Panel>

          <Panel title="Pair comparison">
            <div className="space-y-3 px-4 py-3">
              <div className="flex items-center gap-2">
                {[["b", base, setBase], ["q", quote, setQuote]].map(([k, v, set], i) => (
                  <div key={k as string} className="flex flex-1 items-center gap-2">
                    {i === 1 && <span className="text-[12px] text-muted">vs</span>}
                    <select value={v as string} onChange={(e) => (set as (c: Ccy) => void)(e.target.value as Ccy)} className="num w-full rounded border border-line bg-panel px-2 py-1.5 text-[13px]">
                      {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[17px] font-semibold">{base}/{quote}</span>
                <span className={`num text-[20px] font-semibold ${tone(pairDiff)}`}>{pairDiff === null ? "—" : sg(pairDiff, 1)}</span>
              </div>
              <div className="text-[12px] text-muted">{pairDiff === null ? "Waiting for both scores." : base === quote ? "Pick two different currencies." : `${base} ${scoreOf(base)?.total} vs ${quote} ${scoreOf(quote)?.total} — ${Math.abs(pairDiff) < 1 ? "little fundamental gap" : `tilt toward ${pairDiff > 0 ? base : quote}`}.`}</div>
            </div>
          </Panel>

          <Panel title="News wire" right={
            <div className="flex gap-1">
              {([["all", "All"], ["wire", "FinancialJuice"], ["sel", sel]] as const).map(([k, t]) => (
                <button key={k} onClick={() => setNewsFilter(k)} className={`rounded px-2 py-0.5 text-[11px] font-medium ${newsFilter === k ? "bg-navy text-white" : "text-muted hover:bg-soft"}`}>{t}</button>
              ))}
            </div>}>
            <div className="max-h-[460px] divide-y divide-line/70 overflow-auto">
              {news.map((n) => (
                <a key={n.id} href={n.link} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 hover:bg-soft">
                  <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted">
                    {n.ccy && <span className="num font-semibold text-ink">{n.ccy}</span>}
                    <span className={n.wire ? "font-medium text-navy2" : ""}>{n.source}</span>
                    <span className="num ml-auto">{ago(n.time)}</span>
                  </div>
                  <div className="text-[13px] leading-snug">{n.title}</div>
                </a>
              ))}
              {!news.length && <div className="px-4 py-8 text-center text-[13px] text-muted">{d ? "No headlines for this filter right now." : "Loading headlines…"}</div>}
            </div>
          </Panel>
        </div>
      </main>
      <footer className="mx-auto max-w-[1320px] px-5 pb-8 text-[11px] leading-relaxed text-muted">Research tool, not a trading signal. Sources: BIS, ECB, Bank of Canada, FRED, Forex Factory weekly calendar, FinancialJuice RSS and central-bank press feeds. Every source can fail independently — the indicators at the top show which ones are live.</footer>
    </div>
  );
}
