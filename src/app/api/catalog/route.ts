import { listAccessMatrix } from "@/lib/dal";

export async function GET() {
  return Response.json(await listAccessMatrix());
}
