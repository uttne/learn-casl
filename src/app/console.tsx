"use client";

import { useCallback, useEffect, useState } from "react";
import type { Feature, FeatureState, OrganizationPlan } from "@/lib/authz/contract";
import type { FieldAccess } from "@/lib/authz/present";
import {
  classificationLabel,
  documentStatusLabel,
  featureLabel,
  featureStateLabel,
  fieldAccessLabel,
  planLabel,
  projectStatusLabel,
  roleLabel,
  visibilityLabel,
} from "@/lib/labels";

type Persona = { id: string; email: string; name: string; description: string };

type Organization = {
  id: string;
  name: string;
  plan: OrganizationPlan;
  role: "owner" | "admin" | "member" | "guest";
  department: string;
  clearance: number;
  features: Record<Feature, FeatureState>;
};

type Me = {
  id: string;
  name: string;
  email: string;
  description: string;
  organizations: Organization[];
};

type Project = {
  id: string;
  title: string;
  department: string;
  visibility: "private" | "department" | "organization";
  status: "draft" | "active" | "archived";
  organization: { id: string; name: string; plan: OrganizationPlan };
  owner: { id: string; name: string };
  archive: FeatureState;
  documents: {
    id: string;
    title: string;
    status: "draft" | "published";
    classificationRank: number;
    body: string;
    bodyAccess: FieldAccess;
    author: { id: string; name: string; email: string };
    emailAccess: FieldAccess;
    publish: FeatureState;
  }[];
};

type ApiFailure = { error?: string; layer?: string };

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; layer?: string }> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    return { ok: false, status: response.status, error: body.error ?? "リクエストに失敗しました", layer: body.layer };
  }
  return { ok: true, data: body };
}

function FeatureTable({ organizations }: { organizations: Organization[] }) {
  return (
    <div className="grid gap-4">
      {organizations.map((organization) => (
        <div key={organization.id} className="grid gap-2">
          <h3 className="text-sm font-medium">
            {organization.name} / {planLabel[organization.plan]} / {roleLabel[organization.role]} /{" "}
            {organization.department} / クリアランス {organization.clearance}
          </h3>
          <ul className="grid gap-1 text-sm">
            {(Object.keys(featureLabel) as Feature[]).map((feature) => (
              <li key={feature} className="flex justify-between gap-4 rounded-md bg-zinc-50 px-3 py-1.5 dark:bg-zinc-950">
                <span>{featureLabel[feature]}</span>
                <span>{featureStateLabel[organization.features[feature]]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Console() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [audit, setAudit] = useState<string>("");
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");

  const load = useCallback(async () => {
    const personaResult = await request<{ personas: Persona[] }>("/api/personas");
    if (personaResult.ok) {
      setPersonas(personaResult.data.personas);
      setUserId((current) => current || personaResult.data.personas[0]?.id || "");
    }

    const meResult = await request<{ user: Me }>("/api/me");
    if (!meResult.ok) {
      setMe(null);
      setProjects([]);
      setAudit("");
      return;
    }
    setMe(meResult.data.user);
    setUserId(meResult.data.user.id);

    const projectResult = await request<{ projects: Project[] }>("/api/projects");
    setProjects(projectResult.ok ? projectResult.data.projects : []);
    if (!projectResult.ok) setMessage(`${projectResult.layer ?? "error"}: ${projectResult.error}`);

    const auditEnabled = meResult.data.user.organizations.some((organization) => organization.features["audit.read"] === "enabled");
    const auditDisabled = meResult.data.user.organizations.some((organization) => organization.features["audit.read"] === "disabled");
    if (auditEnabled) {
      const auditResult = await request<{ entries: { title: string; bodyAccess: FieldAccess }[] }>("/api/audit");
      setAudit(auditResult.ok ? auditResult.data.entries.map((entry) => `${entry.title} (${fieldAccessLabel[entry.bodyAccess]})`).join("、") : `${auditResult.status} ${auditResult.error}`);
    } else if (auditDisabled) {
      setAudit("契約には含まれますが、この属性では監査 API を呼べません。");
    } else {
      setAudit("");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function switchUser() {
    setMessage("");
    const result = await request("/api/session", { method: "POST", body: JSON.stringify({ userId }) });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    await load();
  }

  async function createProject(formData: FormData) {
    setMessage("");
    const result = await request("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        organizationId: formData.get("organizationId"),
        title: formData.get("title"),
        department: formData.get("department"),
        visibility: formData.get("visibility"),
      }),
    });
    setMessage(result.ok ? "プロジェクトを作成しました" : `${result.layer}: ${result.error}`);
    if (result.ok) await load();
  }

  async function createDocument(formData: FormData) {
    setMessage("");
    const result = await request("/api/documents", {
      method: "POST",
      body: JSON.stringify({
        projectId: formData.get("projectId"),
        title: formData.get("title"),
        classificationRank: Number(formData.get("classificationRank")),
        body: formData.get("body"),
      }),
    });
    setMessage(result.ok ? "文書を作成しました" : `${result.layer}: ${result.error}`);
    if (result.ok) await load();
  }

  async function mutate(path: string) {
    setMessage("");
    const result = await request(path, { method: "POST", body: "{}" });
    setMessage(result.ok ? "反映しました" : `${result.layer}: ${result.error}`);
    if (result.ok) await load();
  }

  const createOrganizations = me?.organizations.filter((organization) => organization.features["projects.create"] === "enabled") ?? [];
  const createHidden = me ? me.organizations.every((organization) => organization.features["projects.create"] === "hidden") : true;
  const createDisabled = !createHidden && createOrganizations.length === 0;
  const documentOrganizations = me?.organizations.filter((organization) => organization.features["documents.create"] === "enabled") ?? [];

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">ユーザー</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            ペルソナ
            <select className={fieldClass} value={userId} onChange={(event) => setUserId(event.target.value)}>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.name} ({persona.email})
                </option>
              ))}
            </select>
          </label>
          <button className={buttonClass} type="button" onClick={() => void switchUser()}>
            このユーザーとして API を呼ぶ
          </button>
        </div>
        {me ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{me.description}</p> : <p className="text-sm text-zinc-600">未選択です。</p>}
      </section>

      {me ? (
        <>
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">機能</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">契約に無い機能は非表示、契約にあって ABAC で拒否される機能は無効です。</p>
            <FeatureTable organizations={me.organizations} />
          </section>

          <section className="grid gap-4">
            <h2 className="text-lg font-semibold">プロジェクト API</h2>
            {projects.map((project) => (
              <article key={project.id} className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <header className="grid gap-1">
                  <h3 className="font-medium">{project.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {project.organization.name} / {visibilityLabel[project.visibility]} / {project.department} / {projectStatusLabel[project.status]} / {project.owner.name}
                  </p>
                </header>
                {project.archive !== "hidden" ? (
                  <button className={buttonClass} disabled={project.archive !== "enabled"} type="button" onClick={() => void mutate(`/api/projects/${project.id}/archive`)}>
                    アーカイブ（{featureStateLabel[project.archive]}）
                  </button>
                ) : null}
                <ul className="grid gap-3">
                  {project.documents.map((document) => (
                    <li key={document.id} className="grid gap-1 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
                      <span className="font-medium">{document.title}</span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {classificationLabel(document.classificationRank)} / {documentStatusLabel[document.status]} / {document.author.name} / {document.author.email}（{fieldAccessLabel[document.emailAccess]}）
                      </span>
                      <p>
                        {document.body} <span className="text-zinc-500">（本文: {fieldAccessLabel[document.bodyAccess]}）</span>
                      </p>
                      {document.publish !== "hidden" ? (
                        <button className={buttonClass} disabled={document.publish !== "enabled"} type="button" onClick={() => void mutate(`/api/documents/${document.id}/publish`)}>
                          公開（{featureStateLabel[document.publish]}）
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          {audit ? (
            <section className="grid gap-2">
              <h2 className="text-lg font-semibold">監査 API</h2>
              <p className="text-sm">{audit}</p>
            </section>
          ) : null}

          {createHidden ? null : (
            <section className="grid gap-4 md:grid-cols-2">
              <form action={(formData) => void createProject(formData)} className="grid gap-3">
                <h2 className="text-lg font-semibold">プロジェクトを作成</h2>
                <select name="organizationId" className={fieldClass} disabled={createDisabled}>
                  {createOrganizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                <input name="title" className={fieldClass} placeholder="タイトル" disabled={createDisabled} />
                <input name="department" className={fieldClass} placeholder="部門" defaultValue={me.organizations[0]?.department} disabled={createDisabled} />
                <select name="visibility" className={fieldClass} defaultValue="department" disabled={createDisabled}>
                  <option value="private">本人のみ</option>
                  <option value="department">部門</option>
                  <option value="organization">組織</option>
                </select>
                <button className={buttonClass} disabled={createDisabled} type="submit">
                  {createDisabled ? "作成は無効" : "作成"}
                </button>
              </form>
              <form action={(formData) => void createDocument(formData)} className="grid gap-3">
                <h2 className="text-lg font-semibold">文書を作成</h2>
                <select name="projectId" className={fieldClass} disabled={documentOrganizations.length === 0}>
                  {projects
                    .filter((project) => documentOrganizations.some((organization) => organization.id === project.organization.id))
                    .map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                </select>
                <input name="title" className={fieldClass} placeholder="タイトル" disabled={documentOrganizations.length === 0} />
                <select name="classificationRank" className={fieldClass} defaultValue="1" disabled={documentOrganizations.length === 0}>
                  <option value="1">1 公開</option>
                  <option value="2">2 社内</option>
                  <option value="3">3 機密</option>
                </select>
                <textarea name="body" className={fieldClass} rows={3} placeholder="本文" disabled={documentOrganizations.length === 0} />
                <button className={buttonClass} disabled={documentOrganizations.length === 0} type="submit">
                  {documentOrganizations.length === 0 ? "作成は無効" : "下書きを作成"}
                </button>
              </form>
            </section>
          )}
        </>
      ) : null}
      {message ? <p className="text-sm text-red-700 dark:text-red-400">{message}</p> : null}
    </div>
  );
}
