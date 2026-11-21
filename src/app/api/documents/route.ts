import { subject } from "@/lib/authz/ability";
import { authorizeFeature } from "@/lib/authz/gate";
import { clearanceLevels } from "@/lib/authz/principal";
import { jsonError, requireSession } from "@/lib/api";
import { attributeDenied, denialResponse, whereCan } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const result = await requireSession();
  if ("response" in result) return result.response;
  const { session } = result;

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    projectId?: unknown;
    classificationRank?: unknown;
    body?: unknown;
  } | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const classificationRank = typeof body?.classificationRank === "number" ? body.classificationRank : Number.NaN;

  if (title.length < 1 || title.length > 80) return jsonError(400, "input", "タイトルは 1〜80 文字にしてください");
  if (text.length > 500) return jsonError(400, "input", "本文は 500 文字以内にしてください");
  if (!clearanceLevels.includes(classificationRank as (typeof clearanceLevels)[number])) {
    return jsonError(400, "input", "等級が不正です");
  }

  const project = await prisma.project.findFirst({
    where: {
      AND: [{ id: projectId }, whereCan(session.access.data, "read", "Project")],
    },
    select: {
      id: true,
      organizationId: true,
      ownerId: true,
      department: true,
      visibility: true,
      status: true,
    },
  });
  if (!project) return attributeDenied("プロジェクトが見つからないか、参照できません");

  const gate = { api: session.access.api, organizations: session.user.organizations };
  const allowed = authorizeFeature(gate, project.organizationId, "documents.create");
  if (!allowed.ok) return denialResponse(allowed);

  const candidate = {
    title,
    authorId: session.user.id,
    classificationRank,
    status: "draft" as const,
    project,
  };
  if (!session.access.data.can("create", subject("Document", candidate))) {
    return attributeDenied("この文書を作成する権限がありません。等級、プロジェクトの状態、所属を確認してください");
  }

  const document = await prisma.document.create({
    data: {
      title,
      body: text,
      classificationRank,
      status: "draft",
      authorId: session.user.id,
      projectId: project.id,
    },
    select: { id: true },
  });
  return Response.json({ id: document.id }, { status: 201 });
}
