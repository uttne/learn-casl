"use client";

import { useActionState } from "react";

const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

const buttonClass =
  "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export type ActionState = { error: string } | null;

export type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

function FieldError({ state }: { state: ActionState }) {
  if (!state?.error) return null;
  return <p className="text-sm text-red-700 dark:text-red-400">{state.error}</p>;
}

export type CreateProjectFormProps = {
  organizations: { id: string; name: string }[];
  defaultDepartment: string;
  action: FormAction;
  initialState?: ActionState;
};

export function CreateProjectForm({
  organizations,
  defaultDepartment,
  action,
  initialState = null,
}: CreateProjectFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        組織
        <select name="organizationId" className={fieldClass} required>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        タイトル
        <input name="title" className={fieldClass} required maxLength={80} />
      </label>
      <label className="grid gap-1 text-sm">
        部門
        <input
          name="department"
          className={fieldClass}
          list="departments"
          defaultValue={defaultDepartment}
          required
          maxLength={40}
        />
        <datalist id="departments">
          <option value="engineering" />
          <option value="sales" />
          <option value="research" />
        </datalist>
      </label>
      <label className="grid gap-1 text-sm">
        公開範囲
        <select name="visibility" className={fieldClass} defaultValue="department">
          <option value="private">本人のみ</option>
          <option value="department">部門</option>
          <option value="organization">組織</option>
        </select>
      </label>
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "作成中" : "プロジェクトを作成"}
      </button>
      <FieldError state={state} />
    </form>
  );
}

export type CreateDocumentFormProps = {
  projects: { id: string; title: string }[];
  action: FormAction;
  initialState?: ActionState;
};

export function CreateDocumentForm({
  projects,
  action,
  initialState = null,
}: CreateDocumentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        プロジェクト
        <select name="projectId" className={fieldClass} required>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        タイトル
        <input name="title" className={fieldClass} required maxLength={80} />
      </label>
      <label className="grid gap-1 text-sm">
        等級
        <select name="classificationRank" className={fieldClass} defaultValue="1">
          <option value="1">1 公開</option>
          <option value="2">2 社内</option>
          <option value="3">3 機密</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        本文
        <textarea name="body" className={fieldClass} rows={3} maxLength={500} />
      </label>
      <button className={buttonClass} disabled={pending || projects.length === 0} type="submit">
        {pending ? "作成中" : "下書きを作成"}
      </button>
      <FieldError state={state} />
    </form>
  );
}

export function RecordAction({
  action,
  id,
  label,
  initialState = null,
}: {
  action: FormAction;
  id: string;
  label: string;
  initialState?: ActionState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button className={buttonClass} disabled={pending} type="submit">
        {pending ? "送信中" : label}
      </button>
      <FieldError state={state} />
    </form>
  );
}

export function PublishButton({
  id,
  action,
  initialState,
}: {
  id: string;
  action: FormAction;
  initialState?: ActionState;
}) {
  return <RecordAction action={action} id={id} initialState={initialState} label="公開する" />;
}

export function ArchiveButton({
  id,
  action,
  initialState,
}: {
  id: string;
  action: FormAction;
  initialState?: ActionState;
}) {
  return <RecordAction action={action} id={id} initialState={initialState} label="アーカイブ" />;
}

export function ProbeForm({
  publishAction,
  archiveAction,
  initialPublishState = null,
  initialArchiveState = null,
}: {
  publishAction: FormAction;
  archiveAction: FormAction;
  initialPublishState?: ActionState;
  initialArchiveState?: ActionState;
}) {
  const [publishState, publish, publishPending] = useActionState(
    publishAction,
    initialPublishState,
  );
  const [archiveState, archive, archivePending] = useActionState(
    archiveAction,
    initialArchiveState,
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={publish} className="grid gap-2">
        <label className="grid gap-1 text-sm">
          文書 ID を公開
          <input name="id" className={fieldClass} required placeholder="document id" />
        </label>
        <button className={buttonClass} disabled={publishPending} type="submit">
          公開を実行
        </button>
        <FieldError state={publishState} />
      </form>
      <form action={archive} className="grid gap-2">
        <label className="grid gap-1 text-sm">
          プロジェクト ID をアーカイブ
          <input name="id" className={fieldClass} required placeholder="project id" />
        </label>
        <button className={buttonClass} disabled={archivePending} type="submit">
          アーカイブを実行
        </button>
        <FieldError state={archiveState} />
      </form>
    </div>
  );
}
