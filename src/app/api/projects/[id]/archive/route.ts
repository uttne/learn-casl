import { authorizeFeatureSomewhere } from "@/lib/authz/gate";
import { isSamplePreview, requireSession } from "@/lib/api";
import { attributeDenied, denialResponse, whereCan } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await requireSession();
  if ("response" in result) return result.response;
  const { session } = result;
  const { id } = await context.params;

  const gate = { api: session.access.api, organizations: session.user.organizations };
  const allowed = authorizeFeatureSomewhere(gate, "projects.archive");
  if (!allowed.ok) return denialResponse(allowed);

  const current = await prisma.project.findUnique({ where: { id }, select: { status: true } });
  const updated = await prisma.project.updateMany({
    where: {
      AND: [
        { id },
        { organizationId: { in: allowed.organizationIds } },
        whereCan(session.access.data, "archive", "Project"),
      ],
    },
    data: { status: "archived" },
  });
  if (updated.count !== 1) return attributeDenied("このプロジェクトをアーカイブする権限がないか、対象がありません");
  if (isSamplePreview(request) && current) {
    await prisma.project.update({ where: { id }, data: { status: current.status } });
  }
  return Response.json({ ok: true });
}
