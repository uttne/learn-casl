import type { GateDenial } from "@/lib/authz/gate";
import { getSession, type Session } from "@/lib/session";

export function jsonError(status: number, layer: string, error: string) {
  return Response.json({ error, layer }, { status });
}

/** Sample buttons ask the write to be checked, then undone, so the reference table stays fixed. */
export function isSamplePreview(request: Request) {
  return request.headers.get("x-scylla-sample") === "preview";
}

/** 契約か API 入口で止まった応答。layer は contract か resource。 */
export function denialResponse(denial: GateDenial) {
  return jsonError(denial.status, denial.layer, denial.error);
}

/** 行の属性で止まった応答。入口は通ったあとの 403。 */
export function attributeDenied(error: string) {
  return jsonError(403, "attribute", error);
}

export async function requireSession(): Promise<{ session: Session } | { response: Response }> {
  const session = await getSession();
  if (!session) {
    return { response: jsonError(401, "session", "先にユーザーを選んでください") };
  }
  return { session };
}
