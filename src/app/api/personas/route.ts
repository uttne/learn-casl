import { listPersonas } from "@/lib/dal";

export async function GET() {
  return Response.json({ personas: await listPersonas() });
}
