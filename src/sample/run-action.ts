import type { Feature } from "@/lib/authz/contract";
import type { SamplePersona } from "@/sample/actions";

type ListedDocument = {
  id: string;
  title: string;
  body: string;
  publish: "hidden" | "disabled" | "enabled";
};

export type ListedProject = {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  department: string;
  archive: "hidden" | "disabled" | "enabled";
  organization: { id: string; name: string };
  documents: ListedDocument[];
};

export type ActionOutcome = {
  text: string;
  projects?: ListedProject[];
};

type ApiFailure = { error?: string; layer?: string };

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; text: string }> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) return { ok: false, text: `${response.status} ${body.layer ?? ""} ${body.error ?? "失敗しました"}`.trim() };
  return { ok: true, data: body };
}

async function loadProjects(): Promise<{ ok: true; projects: ListedProject[] } | { ok: false; text: string }> {
  const result = await request<{ projects: ListedProject[] }>("/api/projects");
  if (!result.ok) return result;
  return { ok: true, projects: result.data.projects };
}

function projectLines(projects: ListedProject[]) {
  if (projects.length === 0) return "プロジェクトは 0 件です。";
  return projects.map((project) => project.title).join("、");
}

function documentLines(projects: ListedProject[]) {
  const documents = projects.flatMap((project) => project.documents.map((document) => `${document.title}: ${document.body}`));
  if (documents.length === 0) return "文書は 0 件です。";
  return documents.join("\n");
}

/** Call the API for one sample button and describe what came back. */
export async function runAction(feature: Feature, persona: SamplePersona, knownProjects: ListedProject[]): Promise<ActionOutcome> {
  if (feature === "projects.read" || feature === "documents.read") {
    const loaded = await loadProjects();
    if (!loaded.ok) return { text: loaded.text };
    const text = feature === "projects.read" ? projectLines(loaded.projects) : documentLines(loaded.projects);
    return { text, projects: loaded.projects };
  }

  if (feature === "audit.read") {
    const result = await request<{ entries: { title: string }[] }>("/api/audit");
    if (!result.ok) return { text: result.text };
    const titles = result.data.entries.map((entry) => entry.title);
    return { text: titles.length === 0 ? "監査の結果は 0 件です。" : titles.join("、") };
  }

  if (feature === "projects.create") {
    const organization = persona.organizations.find((item) => item.features["projects.create"] === "enabled");
    if (!organization) return { text: "作成できる組織がありません。" };
    const result = await request("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        organizationId: organization.id,
        title: "試しのプロジェクト",
        department: organization.department,
        visibility: "organization",
      }),
    });
    return { text: result.ok ? `${organization.name} に「試しのプロジェクト」を追加しました。` : result.text };
  }

  let listed = knownProjects;
  if (listed.length === 0) {
    const loaded = await loadProjects();
    if (!loaded.ok) return { text: loaded.text };
    listed = loaded.projects;
  }

  if (feature === "projects.archive") {
    const project = listed.find((item) => item.archive === "enabled");
    if (!project) return { text: "取得できたプロジェクトの中に、アーカイブできるものはありません。", projects: listed };
    const result = await request(`/api/projects/${project.id}/archive`, { method: "POST", body: "{}" });
    return { text: result.ok ? `「${project.title}」をアーカイブしました。` : result.text, projects: listed };
  }

  if (feature === "documents.create") {
    const allowedOrganizations = new Set(
      persona.organizations.filter((item) => item.features["documents.create"] === "enabled").map((item) => item.id),
    );
    const project = listed.find((item) => item.status !== "archived" && allowedOrganizations.has(item.organization.id));
    if (!project) return { text: "文書を追加できるプロジェクトがありません。先にプロジェクトを取得してください。", projects: listed };
    const result = await request("/api/documents", {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        title: "試しの文書",
        classificationRank: 1,
        body: "試しの本文です。",
      }),
    });
    return { text: result.ok ? `「${project.title}」に下書き「試しの文書」を追加しました。` : result.text, projects: listed };
  }

  const document = listed
    .flatMap((project) => project.documents.map((item) => ({ ...item, projectTitle: project.title })))
    .find((item) => item.publish === "enabled");
  if (!document) return { text: "取得できた文書の中に、公開できる下書きはありません。", projects: listed };
  const result = await request(`/api/documents/${document.id}/publish`, { method: "POST", body: "{}" });
  return { text: result.ok ? `「${document.title}」を公開しました。` : result.text, projects: listed };
}
