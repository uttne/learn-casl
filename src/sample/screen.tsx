"use client";

// 画面の表示・非表示と、有効なボタンからの API 呼び出し。認可の表は src/guide にあります。

import { useState } from "react";
import { sampleActions, screenFeatureState, type SamplePersona } from "@/sample/actions";
import { FeatureButton } from "@/sample/feature-button";
import { runAction, type HttpExchange, type ListedProject, type RowFocus } from "@/sample/run-action";

const emptyFocus: RowFocus = { projectIds: [], documentIds: [], organizationIds: [] };

function formatResult(http: HttpExchange | null, note?: string) {
  if (!http) return note ?? "呼び出しませんでした。";
  const body = http.body === null ? "" : JSON.stringify(http.body, null, 2);
  return `HTTP ${http.status}\n${body}`;
}

export function SampleScreens({ persona, onFocus }: { persona: SamplePersona; onFocus: (focus: RowFocus) => void }) {
  const [result, setResult] = useState("有効なボタンを押すと、HTTP レスポンスがここに出ます。");
  const [projects, setProjects] = useState<ListedProject[]>([]);

  async function press(feature: (typeof sampleActions)[number]["feature"]) {
    setResult("呼び出しています。");
    const outcome = await runAction(feature, persona, projects);
    if (outcome.projects) setProjects(outcome.projects);
    setResult(formatResult(outcome.http, outcome.note));
    onFocus(outcome.focus);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <section className="grid min-h-0 content-start gap-3 overflow-auto rounded-xl border p-4">
          <div className="grid gap-1">
            <h2 className="font-medium">すべての権限がある画面</h2>
            <p className="text-sm leading-6 text-muted-foreground">認可を掛ける前の見た目です。ボタンはすべて表示され、押せます。API は呼びません。</p>
          </div>
          {sampleActions.map((action) => (
            <FeatureButton
              key={action.feature}
              label={action.label}
              call={action.call}
              state="enabled"
              onPress={() => {
                setResult("こちらは見本です。API は呼びません。");
                onFocus(emptyFocus);
              }}
            />
          ))}
        </section>

        <section className="grid min-h-0 content-start gap-3 overflow-auto rounded-xl border p-4">
          <div className="grid gap-1">
            <h2 className="font-medium">{persona.name} の画面</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              契約に無い機能は非表示、属性で許されない機能は無効です。有効なボタンだけ API を呼びます。
            </p>
          </div>
          {sampleActions.map((action) => {
            const state = screenFeatureState(persona, action.feature);
            return (
              <FeatureButton
                key={action.feature}
                label={action.label}
                call={action.call}
                state={state}
                onPress={state === "enabled" ? () => void press(action.feature) : undefined}
              />
            );
          })}
        </section>
      </div>
      <pre className="h-36 shrink-0 overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{result}</pre>
    </div>
  );
}
