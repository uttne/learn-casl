import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return jsonError(404, "session", "ユーザーが見つかりません");

  const jar = await cookies();
  jar.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return Response.json({ ok: true });
}
