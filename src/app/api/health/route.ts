import { getDashboard } from "@/lib/dashboard";
export const dynamic = "force-dynamic";
export async function GET() {
  const d = await getDashboard();
  return Response.json({ generatedAt: d.generatedAt, sources: d.health, ai: process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GROQ_API_KEY ? "groq" : "rules-only" });
}
