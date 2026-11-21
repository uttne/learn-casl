import { authorizeFeatureSomewhere } from "@/lib/authz/gate";
import { requireSession } from "@/lib/api";
import { denialResponse, listVisibleAudit } from "@/lib/dal";

export async function GET() {
  const result = await requireSession();
  if ("response" in result) return result.response;
  const { session } = result;

  const gate = { api: session.access.api, organizations: session.user.organizations };
  const allowed = authorizeFeatureSomewhere(gate, "audit.read");
  if (!allowed.ok) return denialResponse(allowed);

  const entries = await listVisibleAudit(session.access.data, allowed.organizationIds);
  return Response.json({
    entries: entries.map((entry) => ({
      id: entry.id,
      projectId: entry.projectId,
      title: entry.title,
      status: entry.status,
      classificationRank: entry.classificationRank,
      body: entry.body,
      bodyAccess: entry.bodyAccess,
      author: entry.author,
      emailAccess: entry.emailAccess,
    })),
  });
}
