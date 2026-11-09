import type { Dashboard } from "./types";
import { getRates } from "./sources/rates";
import { getCalendar } from "./sources/calendar";
import { getNews } from "./sources/news";
import { scoreAll } from "./scoring"; import { applyReleases } from "./releases";

export async function getDashboard(): Promise<Dashboard> {
  const [r, c, n] = await Promise.all([getRates(), getCalendar(), getNews()]);
    const events = applyReleases(c.events, n.news);
  const filled = events.filter((e) => e.actualSrc).length;
  const cal = { ...c.health, detail: `${events.length} high-impact events · ${filled} actuals from FinancialJuice` };
  return {
    generatedAt: new Date().toISOString(),
    rates: r.rates,
      events,
    news: n.news,
    scores: scoreAll(r.rates, events, n.news),
    health: [r.health, cal, ...n.health],
  };
}
