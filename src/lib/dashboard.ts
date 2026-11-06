import type { Dashboard } from "./types";
import { getRates } from "./sources/rates";
import { getCalendar } from "./sources/calendar";
import { getNews } from "./sources/news";
import { scoreAll } from "./scoring";

export async function getDashboard(): Promise<Dashboard> {
  const [r, c, n] = await Promise.all([getRates(), getCalendar(), getNews()]);
  return {
    generatedAt: new Date().toISOString(),
    rates: r.rates,
    events: c.events,
    news: n.news,
    scores: scoreAll(r.rates, c.events, n.news),
    health: [r.health, c.health, ...n.health],
  };
}
