"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Comparison, type AccessMatrix } from "@/guide/comparison";
import type { Feature, FeatureState, OrganizationPlan } from "@/lib/authz/contract";
import { SampleScreens } from "@/sample/screen";

type Persona = {
  id: string;
  email: string;
  name: string;
  description: string;
  organizations: {
    id: string;
    name: string;
    plan: OrganizationPlan;
    role: "owner" | "admin" | "member" | "guest";
    department: string;
    clearance: number;
    features: Record<Feature, FeatureState>;
    dataNotes: string[];
  }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) return { ok: false, error: body.error ?? "リクエストに失敗しました" };
  return { ok: true, data: body };
}

export function Workspace() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [userId, setUserId] = useState("");
  const [matrix, setMatrix] = useState<AccessMatrix | null>(null);
  const requestId = useRef(0);

  const loadMatrix = useCallback(async () => {
    const result = await request<AccessMatrix>("/api/catalog");
    if (result.ok) setMatrix(result.data);
  }, []);

  const activate = useCallback(async (id: string) => {
    const token = ++requestId.current;
    setUserId(id);
    const switched = await request("/api/session", { method: "POST", body: JSON.stringify({ userId: id }) });
    if (token !== requestId.current || !switched.ok) return;
    await loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      const personaResult = await request<{ personas: Persona[] }>("/api/personas");
      if (!active || !personaResult.ok) return;
      setPersonas(personaResult.data.personas);
      const meResult = await request<{ user: Persona }>("/api/me");
      if (!active) return;
      const id = meResult.ok ? meResult.data.user.id : personaResult.data.personas[0]?.id;
      if (id) await activate(id);
    });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [activate]);

  const selected = personas.find((persona) => persona.id === userId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Scylla</h1>
          <p className="text-sm text-muted-foreground">左でボタンを試し、右の表で同じ人の取得結果と照らし合わせます。</p>
        </div>
        <label className="grid gap-1 text-sm">
          操作する人
          <select
            className="h-8 rounded-lg border bg-background px-2"
            value={userId}
            onChange={(event) => {
              void activate(event.target.value);
            }}
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}（{persona.email}）
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <section className="min-h-0 overflow-auto rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">動作する画面</h2>
          {selected ? (
            <SampleScreens key={selected.id} persona={selected} onChanged={() => void loadMatrix()} />
          ) : (
            <p className="text-sm text-muted-foreground">ユーザーを読み込んでいます。</p>
          )}
        </section>
        <section className="flex min-h-0 flex-col rounded-xl border p-4">
          <h2 className="mb-3 shrink-0 text-sm font-medium text-muted-foreground">認可の対応表</h2>
          <div className="min-h-0 flex-1">
            {matrix ? (
              <Comparison
                matrix={matrix}
                personas={personas}
                selectedId={userId}
                onSelect={(id) => {
                  void activate(id);
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">表を読み込んでいます。</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
