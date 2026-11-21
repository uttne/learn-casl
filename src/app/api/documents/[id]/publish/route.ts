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
  const allowed = authorizeFeatureSomewhere(gate, "documents.publish");
  if (!allowed.ok) return denialResponse(allowed);

  const updated = await prisma.document.updateMany({
    where: {
      AND: [
        { id },
        { project: { is: { organizationId: { in: allowed.organizationIds } } } },
        whereCan(session.access.data, "publish", "Document"),
      ],
    },
    data: { status: "published" },
  });
  if (updated.count !== 1) return attributeDenied("この文書を公開する権限がないか、対象がありません");
  return Response.json({ ok: true });
}
