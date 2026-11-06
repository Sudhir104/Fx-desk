import Dashboard from "@/components/Dashboard";
import { getDashboard } from "@/lib/dashboard";
import type { Dashboard as D } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Never let a slow upstream block the first paint: after 6s the client fetches by itself.
  const initial = await Promise.race<D | null>([getDashboard(), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
  return <Dashboard initial={initial} />;
}
