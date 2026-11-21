import { toPersonaProfile } from "@/lib/authz/profile";
import { requireSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireSession();
  if ("response" in result) return result.response;

  const user = await prisma.user.findUnique({
    where: { id: result.session.user.id },
    include: { memberships: { include: { organization: true } } },
  });
  if (!user) return Response.json({ error: "先にユーザーを選んでください", layer: "session" }, { status: 401 });

  return Response.json({ user: toPersonaProfile(user) });
}
