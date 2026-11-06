export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD"] as const;
export type Ccy = (typeof CURRENCIES)[number];

export const BANKS: Record<Ccy, { bank: string; bis: string; url: string }> = {
  USD: { bank: "Federal Reserve", bis: "US", url: "https://www.federalreserve.gov/monetarypolicy/openmarket.htm" },
  EUR: { bank: "European Central Bank", bis: "XM", url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
  GBP: { bank: "Bank of England", bis: "GB", url: "https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate" },
  JPY: { bank: "Bank of Japan", bis: "JP", url: "https://www.boj.or.jp/en/mopo/mpmdeci/index.htm" },
  CHF: { bank: "Swiss National Bank", bis: "CH", url: "https://www.snb.ch/en/the-snb/mandates-goals/monetary-policy/decisions" },
  AUD: { bank: "Reserve Bank of Australia", bis: "AU", url: "https://www.rba.gov.au/statistics/cash-rate/" },
  NZD: { bank: "Reserve Bank of New Zealand", bis: "NZ", url: "https://www.rbnz.govt.nz/monetary-policy/about-monetary-policy/official-cash-rate" },
  CAD: { bank: "Bank of Canada", bis: "CA", url: "https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/" },
};

export type Health = { id: string; label: string; ok: boolean; stale: boolean; error?: string; fetchedAt?: string; detail?: string };

export type RateInfo = {
  ccy: Ccy;
  rate: number | null;
  asOf: string | null;
  change6m: number | null;
  change12m: number | null;
  lastMoveDate: string | null;
  lastMoveSize: number | null;
  source: string;
};

export type Bias = "bullish" | "bearish" | "neutral" | "pending";
export type CalEvent = {
  id: string; date: string; ccy: Ccy; title: string;
  actual: string | null; forecast: string | null; previous: string | null;
  released: boolean; bias: Bias;
};

export type NewsItem = { id: string; title: string; link: string; time: string; source: string; wire: boolean; ccy: Ccy | null; tone: number };

export type Factor = { key: string; label: string; weight: number; score: number | null; note: string };
export type Score = { ccy: Ccy; total: number | null; label: string; coverage: number; factors: Factor[] };

export type Dashboard = {
  generatedAt: string;
  rates: RateInfo[];
  scores: Score[];
  events: CalEvent[];
  news: NewsItem[];
  health: Health[];
};
