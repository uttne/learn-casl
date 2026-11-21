import { subject } from "@/lib/authz/ability";
import { authorizeFeature, authorizeFeatureSomewhere } from "@/lib/authz/gate";
import { projectVisibilities, type ProjectVisibility } from "@/lib/authz/principal";
import { jsonError, requireSession } from "@/lib/api";
import {
  attributeDenied,
  denialResponse,
  documentPublishState,
  listVisibleProjects,
  projectArchiveState,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const result = await requireSession();
  if ("response" in result) return result.response;
  const { session } = result;
  const gate = { api: session.access.api, organizations: session.user.organizations };
  const allowed = authorizeFeatureSomewhere(gate, "projects.read");
  if (!allowed.ok) return denialResponse(allowed);

  const projects = await listVisibleProjects(session.access.data, allowed.organizationIds);
  return Response.json({
    projects: projects.map((project) => ({
      id: project.id,
      title: project.title,
      department: project.department,
      visibility: project.visibility,
      status: project.status,
      organization: project.organization,
      owner: project.owner,
      archive: projectArchiveState(gate, session.access.data, {
        id: project.id,
        title: project.title,
        organizationId: project.organization.id,
        ownerId: project.owner.id,
        department: project.department,
        visibility: project.visibility,
        status: project.status,
      }),
      documents: project.documents.map((document) => ({
        id: document.id,
        title: document.title,
        status: document.status,
        classificationRank: document.classificationRank,
        body: document.body,
        bodyAccess: document.bodyAccess,
        author: document.author,
        emailAccess: document.emailAccess,
        publish: documentPublishState(gate, session.access.data, document),
      })),
    })),
  });
}

export async function POST(request: Request) {
  const result = await requireSession();
  if ("response" in result) return result.response;
  const { session } = result;

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    department?: unknown;
    organizationId?: unknown;
    visibility?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const visibility = typeof body?.visibility === "string" ? body.visibility : "";

  if (title.length < 1 || title.length > 80) return jsonError(400, "input", "タイトルは 1〜80 文字にしてください");
  if (department.length < 1 || department.length > 40) return jsonError(400, "input", "部門は 1〜40 文字にしてください");
  if (!projectVisibilities.includes(visibility as ProjectVisibility)) {
    return jsonError(400, "input", "公開範囲が不正です");
  }

  const gate = { api: session.access.api, organizations: session.user.organizations };
  const allowed = authorizeFeature(gate, organizationId, "projects.create");
  if (!allowed.ok) return denialResponse(allowed);

  const candidate = {
    title,
    organizationId,
    ownerId: session.user.id,
    department,
    visibility: visibility as ProjectVisibility,
    status: "active" as const,
  };
  if (!session.access.data.can("create", subject("Project", candidate))) {
    return attributeDenied("この条件のプロジェクトを作成する権限がありません");
  }

  const project = await prisma.project.create({ data: candidate, select: { id: true } });
  return Response.json({ id: project.id }, { status: 201 });
}
