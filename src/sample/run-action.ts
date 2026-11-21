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

export type HttpExchange = {
  status: number;
  body: unknown;
};

export type RowFocus = {
  projectIds: string[];
  documentIds: string[];
  organizationIds: string[];
};

export type ActionOutcome = {
  http: HttpExchange | null;
  note?: string;
  focus: RowFocus;
  projects?: ListedProject[];
};

const previewHeaders = { "x-scylla-sample": "preview" };
const emptyFocus: RowFocus = { projectIds: [], documentIds: [], organizationIds: [] };

async function request(path: string, init?: RequestInit): Promise<HttpExchange & { ok: boolean }> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  } else {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

async function loadProjects(): Promise<{ ok: true; projects: ListedProject[]; http: HttpExchange } | { ok: false; http: HttpExchange }> {
  const http = await request("/api/projects");
  if (!http.ok) return { ok: false, http };
  const projects = (http.body as { projects?: ListedProject[] }).projects ?? [];
  return { ok: true, projects, http };
}

/** Call the API for one sample button. Writes are previewed, then undone. */
export async function runAction(feature: Feature, persona: SamplePersona, knownProjects: ListedProject[]): Promise<ActionOutcome> {
  if (feature === "projects.read" || feature === "documents.read") {
    const loaded = await loadProjects();
    if (!loaded.ok) return { http: loaded.http, focus: emptyFocus };
    const focus =
      feature === "projects.read"
        ? { projectIds: loaded.projects.map((project) => project.id), documentIds: [], organizationIds: [] }
        : {
            projectIds: [],
            documentIds: loaded.projects.flatMap((project) => project.documents.map((document) => document.id)),
            organizationIds: [],
          };
    return { http: loaded.http, focus, projects: loaded.projects };
  }

  if (feature === "audit.read") {
    const http = await request("/api/audit");
    if (!http.ok) return { http, focus: emptyFocus };
    const entries = (http.body as { entries?: { id: string }[] }).entries ?? [];
    return { http, focus: { projectIds: [], documentIds: entries.map((entry) => entry.id), organizationIds: [] } };
  }

  if (feature === "projects.create") {
    const organization = persona.organizations.find((item) => item.features["projects.create"] === "enabled");
    if (!organization) return { http: null, note: "作成できる組織がありません。", focus: emptyFocus };
    const http = await request("/api/projects", {
      method: "POST",
      headers: previewHeaders,
      body: JSON.stringify({
        organizationId: organization.id,
        title: "試しのプロジェクト",
        department: organization.department,
        visibility: "organization",
      }),
    });
    return { http, focus: { projectIds: [], documentIds: [], organizationIds: [organization.id] } };
  }

  let listed = knownProjects;
  if (listed.length === 0) {
    const loaded = await loadProjects();
    if (!loaded.ok) return { http: loaded.http, focus: emptyFocus };
    listed = loaded.projects;
  }

  if (feature === "projects.archive") {
    const project = listed.find((item) => item.archive === "enabled");
    if (!project) return { http: null, note: "取得できたプロジェクトの中に、アーカイブできるものはありません。", focus: emptyFocus, projects: listed };
    const http = await request(`/api/projects/${project.id}/archive`, {
      method: "POST",
      headers: previewHeaders,
      body: "{}",
    });
    return { http, focus: { projectIds: [project.id], documentIds: [], organizationIds: [] }, projects: listed };
  }

  if (feature === "documents.create") {
    const allowedOrganizations = new Set(
      persona.organizations.filter((item) => item.features["documents.create"] === "enabled").map((item) => item.id),
    );
    const project = listed.find((item) => item.status !== "archived" && allowedOrganizations.has(item.organization.id));
    if (!project) return { http: null, note: "文書を追加できるプロジェクトがありません。先にプロジェクトを取得してください。", focus: emptyFocus, projects: listed };
    const http = await request("/api/documents", {
      method: "POST",
      headers: previewHeaders,
      body: JSON.stringify({
        projectId: project.id,
        title: "試しの文書",
        classificationRank: 1,
        body: "試しの本文です。",
      }),
    });
    return { http, focus: { projectIds: [project.id], documentIds: [], organizationIds: [] }, projects: listed };
  }

  const document = listed.flatMap((project) => project.documents).find((item) => item.publish === "enabled");
  if (!document) return { http: null, note: "取得できた文書の中に、公開できる下書きはありません。", focus: emptyFocus, projects: listed };
  const http = await request(`/api/documents/${document.id}/publish`, {
    method: "POST",
    headers: previewHeaders,
    body: "{}",
  });
  return { http, focus: { projectIds: [], documentIds: [document.id], organizationIds: [] }, projects: listed };
}
