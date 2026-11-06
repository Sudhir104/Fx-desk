import type { Dashboard } from "./types";

type Note = { text: string; source: "ai" | "rules"; model?: string; generatedAt: string };
let memo: { key: string; t: number; note: Note } | null = null;

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

function facts(d: Dashboard) {
  const ranked = d.scores.filter((s) => s.total !== null);
  const pick = (s: (typeof ranked)[number]) => ({ ccy: s.ccy, score: s.total, read: s.label, drivers: s.factors.filter((f) => f.score !== null).map((f) => `${f.label}: ${f.note}`) });
  return {
    strongest: ranked.slice(0, 2).map(pick),
    weakest: ranked.slice(-2).map(pick),
    policyRates: d.rates.filter((r) => r.rate !== null).map((r) => ({ ccy: r.ccy, rate: r.rate, change6m: r.change6m, lastMove: r.lastMoveDate ? `${r.lastMoveSize} on ${r.lastMoveDate}` : null })),
    releasedEvents: d.events.filter((e) => e.released).slice(-6).map((e) => ({ ccy: e.ccy, event: e.title, actual: e.actual, forecast: e.forecast, result: e.bias })),
    upcoming: d.events.filter((e) => !e.released && Date.parse(e.date) > Date.now()).slice(0, 5).map((e) => ({ ccy: e.ccy, event: e.title, when: e.date })),
    headlines: d.news.slice(0, 8).map((n) => ({ source: n.source, title: n.title })),
    unavailable: d.health.filter((h) => !h.ok).map((h) => h.label),
  };
}

export function rulesNote(d: Dashboard): string {
  const r = d.scores.filter((s) => s.total !== null);
  if (!r.length) return "Not enough live data to write a note yet — check the data-source indicators at the top of the page.";
  const top = r[0], bot = r[r.length - 1];
  const ev = d.events.filter((e) => e.released && e.bias !== "pending" && e.bias !== "neutral").slice(-1)[0];
  return [
    `${top.ccy} carries the strongest fundamental bias (${top.total! > 0 ? "+" : ""}${top.total}, ${top.label.toLowerCase()}); ${bot.ccy} the weakest (${bot.total! > 0 ? "+" : ""}${bot.total}, ${bot.label.toLowerCase()}).`,
    ev ? `Latest Red Folder surprise: ${ev.ccy} ${ev.title} printed ${ev.actual} vs ${ev.forecast} forecast — ${ev.bias}.` : "No high-impact result has been released yet this week.",
    "Scores combine policy-rate momentum, rate level, data surprises and headline tone. Read the underlying releases before acting.",
  ].join(" ");
}

const SYSTEM = "You write a short macro-FX desk note for a retail trader. Use ONLY the facts in the JSON the user sends. Never invent numbers, dates, quotes or events. 90-130 words, plain English, two short paragraphs. Mention which currencies lead and lag and why, then the most relevant recent data or headline. If a data source is listed as unavailable, say so in one clause. No trade recommendations, no price targets.";

async function callAnthropic(key: string, user: string) {
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 400, system: SYSTEM, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Anthropic HTTP ${r.status}`);
  const j = await r.json();
  const text = (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
  if (!text) throw new Error("empty AI response");
  return { text, model };
}
async function callGroq(key: string, user: string) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 400, temperature: 0.3, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Groq HTTP ${r.status}`);
  const j = await r.json();
  const text = (j.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("empty AI response");
  return { text, model };
}

export async function getDeskNote(d: Dashboard): Promise<Note> {
  const f = JSON.stringify(facts(d));
  const key = hash(f);
  if (memo && memo.key === key && Date.now() - memo.t < 20 * 60 * 1000) return memo.note;
  let note: Note;
  try {
    const a = process.env.ANTHROPIC_API_KEY, g = process.env.GROQ_API_KEY;
    if (!a && !g) throw new Error("no AI key");
    const res = a ? await callAnthropic(a, f) : await callGroq(g as string, f);
    note = { text: res.text, source: "ai", model: res.model, generatedAt: new Date().toISOString() };
  } catch {
    note = { text: rulesNote(d), source: "rules", generatedAt: new Date().toISOString() };
  }
  memo = { key, t: Date.now(), note };
  return note;
}
