import { authorizeFeatureSomewhere } from "@/lib/authz/gate";
import { requireSession } from "@/lib/api";
import { attributeDenied, denialResponse, whereCan } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const result = await requireSession();
  if ("response" in result) return result.response;
  const { session } = result;
  const { id } = await context.params;

  const gate = { api: session.access.api, organizations: session.user.organizations };
  const allowed = authorizeFeatureSomewhere(gate, "projects.archive");
  if (!allowed.ok) return denialResponse(allowed);

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
  return Response.json({ ok: true });
}
