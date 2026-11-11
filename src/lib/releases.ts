
import type { CalEvent, NewsItem } from "./types";
import { ffBias, ffNum } from "./sources/calendar";
import { parseRelease, releaseCcy } from "./sources/news";

const STOP = new Set(["the", "and", "rate", "index", "change"]);

const words = (s: string) =>
  s.toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

export function applyReleases(
  events: CalEvent[],
  news: NewsItem[]
): CalEvent[] {
  const releases = news
    .filter((n) => n.wire)
    .map((n) => ({
      news: n,
      parsed: parseRelease(n.title),
      currency: releaseCcy(n.title),
    }))
    .filter((x) => x.parsed !== null && x.currency !== null);

  return events.map((event) => {
    if (event.released) return event;

    const forecast = ffNum(event.forecast);
    const eventTime = Date.parse(event.date);

    if (forecast === null || !Number.isFinite(eventTime)) {
      return event;
    }

    const eventWords = words(event.title);

    const candidates = releases
      .filter((x) => {
        if (x.currency !== event.ccy || !x.parsed) return false;

        if (ffNum(x.parsed.forecast) !== forecast) return false;

        const newsTime = Date.parse(x.news.time);

        return (
          Number.isFinite(newsTime) &&
          newsTime >= eventTime - 60 * 60 * 1000 &&
          newsTime <= eventTime + 24 * 60 * 60 * 1000
        );
      })
      .map((x) => ({
        ...x,
        score: words(x.news.title).filter(
          (w) => eventWords.includes(w)
        ).length,
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) return event;

    const best = candidates[0];

    const tied = candidates.filter(
      (x) => x.score === best.score
    );

    const actualValues = new Set(
      tied.map((x) => ffNum(x.parsed!.actual))
    );

    if (actualValues.size > 1) return event;

    const actual = best.parsed!.actual;

    if (ffNum(actual) === null) return event;

    return {
      ...event,
      actual,
      released: true,
      bias: ffBias(event.title, actual, event.forecast),
      actualSrc: "FinancialJuice",
    };
  });
}
