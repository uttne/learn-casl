import { authorizeFeatureSomewhere } from "@/lib/authz/gate";
import { whereCan } from "@/lib/authz/rows";
import { attributeDenied, denialResponse, isSamplePreview, requireSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await requireSession();
  if ("response" in result) return result.response;
  const { session } = result;
  const { id } = await context.params;

  // 入口。アーカイブできる組織が一つも無ければ、行は見ない。
  const gate = { api: session.access.api, organizations: session.user.organizations };
  const allowed = authorizeFeatureSomewhere(gate, "projects.archive");
  if (!allowed.ok) return denialResponse(allowed);

  const current = await prisma.project.findUnique({ where: { id }, select: { status: true } });
  const updated = await prisma.project.updateMany({
    where: {
      // 入口で残った組織と、行ルールの WHERE を両方とも満たす行だけ更新する。
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
