import { getDashboard } from "@/lib/dashboard";
import { getDeskNote } from "@/lib/deskNote";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET() {
  return Response.json(await getDeskNote(await getDashboard()));
}
