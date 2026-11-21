"use client";

// アカウントごとの取得結果を見比べる表。ボタンの動作は src/sample にあります。

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { OrganizationPlan } from "@/lib/authz/contract";
import type { RowFocus } from "@/sample/run-action";
import type { FieldAccess } from "@/lib/authz/present";
import {
  classificationLabel,
  documentStatusLabel,
  fieldAccessLabel,
  projectStatusLabel,
  roleLabel,
  visibilityLabel,
} from "@/lib/labels";

type Persona = {
  id: string;
  name: string;
  organizations: {
    name: string;
    plan: OrganizationPlan;
    role: "owner" | "admin" | "member" | "guest";
    department: string;
    clearance: number;
  }[];
};

type StoredDocument = {
  id: string;
  title: string;
  body: string;
  classificationRank: number;
  status: "draft" | "published";
  author: { id: string; name: string; email: string };
};

type StoredProject = {
  id: string;
  title: string;
  department: string;
  visibility: "private" | "department" | "organization";
  status: "draft" | "active" | "archived";
  organization: { id: string; name: string; plan: OrganizationPlan };
  owner: { id: string; name: string };
  documents: StoredDocument[];
};

type ReturnedDocument = {
  id: string;
  body: string;
  bodyAccess: FieldAccess;
  email: string;
  emailAccess: FieldAccess;
};

export type AccessMatrix = {
  projects: StoredProject[];
  views: {
    userId: string;
    projects: { id: string; documents: ReturnedDocument[] }[];
  }[];
};

const accessTone: Record<FieldAccess, string> = {
  visible: "text-emerald-700 dark:text-emerald-400",
  masked: "text-amber-700 dark:text-amber-400",
  replaced: "text-rose-700 dark:text-rose-400",
};

function indexViews(matrix: AccessMatrix) {
  return new Map(
    matrix.views.map((view) => [
      view.userId,
      new Map(
        view.projects.map((project) => [project.id, new Map(project.documents.map((document) => [document.id, document]))]),
      ),
    ]),
  );
}

export function Comparison({
  matrix,
  personas,
  selectedId,
  focus,
  onSelect,
}: {
  matrix: AccessMatrix;
  personas: Persona[];
  selectedId: string;
  focus: RowFocus;
  onSelect: (userId: string) => void;
}) {
  const views = indexViews(matrix);
  const projectFocus = new Set(focus.projectIds);
  const documentFocus = new Set(focus.documentIds);
  const organizationFocus = new Set(focus.organizationIds);

  useEffect(() => {
    document.querySelector("[data-focus='true']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focus]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-2">
      <p className="shrink-0 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        見本のデータの対応表です。左の操作では行は増えません。操作した行は色が変わります。プロジェクトの作成は、追加先の組織にあるプロジェクトの行が対象です。
      </p>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <TopScroll>
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="sticky top-0 left-0 z-30 min-w-72 bg-white p-3 font-medium dark:bg-zinc-950">データ</th>
              {personas.map((persona) => {
                const selected = persona.id === selectedId;
                return (
                  <th
                    key={persona.id}
                    className={`sticky top-0 z-20 min-w-44 p-2 align-bottom font-normal ${selected ? "bg-emerald-50 dark:bg-emerald-950" : "bg-white dark:bg-zinc-950"}`}
                  >
                    <button
                      type="button"
                      className={`grid w-full gap-1 rounded-md px-2 py-1 text-left ${selected ? "font-semibold" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}
                      onClick={() => onSelect(persona.id)}
                    >
                      <span>{persona.name}</span>
                      <span className="text-xs font-normal leading-5 text-zinc-500">
                        {persona.organizations
                          .map(
                            (organization) =>
                              `${organization.name} ${roleLabel[organization.role]} / ${organization.department} / ${classificationLabel(organization.clearance)}`,
                          )
                          .join("、")}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {matrix.projects.map((project) => (
              <ProjectRows
                key={project.id}
                project={project}
                personas={personas}
                selectedId={selectedId}
                projectFocused={projectFocus.has(project.id) || organizationFocus.has(project.organization.id)}
                documentFocus={documentFocus}
                views={views}
              />
            ))}
          </tbody>
        </table>
        </TopScroll>
      </div>
    </section>
  );
}

function TopScroll({ children }: { children: ReactNode }) {
  const top = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const scroller = body.current;
    const content = scroller?.firstElementChild;
    if (!scroller || !content) return;
    const update = () => setWidth(content.scrollWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, [children]);

  function follow(source: HTMLDivElement, target: HTMLDivElement | null) {
    if (target && target.scrollLeft !== source.scrollLeft) target.scrollLeft = source.scrollLeft;
  }

  return (
    <>
      <div
        ref={top}
        className="h-4 shrink-0 overflow-x-scroll overflow-y-hidden"
        onScroll={(event) => follow(event.currentTarget, body.current)}
      >
        <div style={{ width }} className="h-px" />
      </div>
      <div ref={body} className="min-h-0 flex-1 overflow-auto" onScroll={(event) => follow(event.currentTarget, top.current)}>
        {children}
      </div>
    </>
  );
}

function cellTone(focused: boolean, selected: boolean, resting: string) {
  if (focused && selected) return "bg-amber-200 dark:bg-amber-900";
  if (focused) return "bg-amber-100 dark:bg-amber-950";
  if (selected) return "bg-emerald-50 dark:bg-emerald-950/40";
  return resting;
}

function ProjectRows({
  project,
  personas,
  selectedId,
  projectFocused,
  documentFocus,
  views,
}: {
  project: StoredProject;
  personas: Persona[];
  selectedId: string;
  projectFocused: boolean;
  documentFocus: Set<string>;
  views: ReturnType<typeof indexViews>;
}) {
  const projectTone = cellTone(projectFocused, false, "bg-zinc-50 dark:bg-zinc-900");
  return (
    <>
      <tr className="border-t border-zinc-200 dark:border-zinc-800" data-focus={projectFocused ? "true" : undefined}>
        <th className={`sticky left-0 z-10 p-3 text-left font-medium ${projectTone}`}>
          <span className="block">{project.title}</span>
          <span className="mt-1 block text-xs font-normal leading-5 text-zinc-500">
            {project.organization.name} / {visibilityLabel[project.visibility]} / {project.department} / 状態 {projectStatusLabel[project.status]} / 所有者 {project.owner.name}
          </span>
        </th>
        {personas.map((persona) => {
          const returned = views.get(persona.id)?.has(project.id) ?? false;
          const selected = persona.id === selectedId;
          return (
            <td key={persona.id} className={`p-3 ${cellTone(projectFocused, selected, "bg-zinc-50 dark:bg-zinc-900")}`}>
              <span className={returned ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-400"}>{returned ? "返る" : "返らない"}</span>
            </td>
          );
        })}
      </tr>
      {project.documents.map((document) => {
        const focused = documentFocus.has(document.id);
        const documentTone = cellTone(focused, false, "bg-white dark:bg-zinc-950");
        return (
          <tr key={document.id} className="border-t border-zinc-100 dark:border-zinc-900" data-focus={focused ? "true" : undefined}>
            <th className={`sticky left-0 z-10 p-3 pl-6 text-left font-normal ${documentTone}`}>
              <span className="block font-medium">{document.title}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">
                {classificationLabel(document.classificationRank)} / {documentStatusLabel[document.status]} / {document.author.name}
              </span>
              <span className="mt-1 block leading-5 text-zinc-700 dark:text-zinc-300">{document.body}</span>
              <span className="block text-xs text-zinc-500">{document.author.email}</span>
            </th>
            {personas.map((persona) => (
              <td key={persona.id} className={`p-3 align-top ${cellTone(focused, persona.id === selectedId, "bg-white dark:bg-zinc-950")}`}>
                <DocumentCell document={views.get(persona.id)?.get(project.id)?.get(document.id)} />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

function DocumentCell({ document }: { document: ReturnedDocument | undefined }) {
  if (!document) return <span className="text-zinc-400">返らない</span>;
  return (
    <div className="grid gap-1">
      <span className={accessTone[document.bodyAccess]}>本文 {fieldAccessLabel[document.bodyAccess]}</span>
      <span className="leading-5">{document.body}</span>
      <span className={`text-xs ${accessTone[document.emailAccess]}`}>
        {document.email}（{fieldAccessLabel[document.emailAccess]}）
      </span>
    </div>
  );
}
