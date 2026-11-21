import { getSession, type Session } from "@/lib/session";

export function jsonError(status: number, layer: string, error: string) {
  return Response.json({ error, layer }, { status });
}

export async function requireSession(): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession();
  if (!session) {
    return { response: jsonError(401, "session", "先にユーザーを選んでください") };
  }
  return { session };
}
