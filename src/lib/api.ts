import { getSession, type Session } from "@/lib/session";

export function jsonError(status: number, layer: string, error: string) {
  return Response.json({ error, layer }, { status });
}

/** Sample buttons ask the write to be checked, then undone, so the reference table stays fixed. */
export function isSamplePreview(request: Request) {
  return request.headers.get("x-scylla-sample") === "preview";
}

export async function requireSession(): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession();
  if (!session) {
    return { response: jsonError(401, "session", "先にユーザーを選んでください") };
  }
  return { session };
}
