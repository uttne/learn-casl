"use client";

// 画面の表示・非表示と、有効なボタンからの API 呼び出し。認可の表は src/guide にあります。

import { useState } from "react";
import { sampleActions, screenFeatureState, type SamplePersona } from "@/sample/actions";
import { FeatureButton } from "@/sample/feature-button";
import { runAction, type ListedProject } from "@/sample/run-action";

export function SampleScreens({ persona, onChanged }: { persona: SamplePersona; onChanged: () => void }) {
  const [result, setResult] = useState("有効なボタンを押すと、その API の結果がここに出ます。");
  const [projects, setProjects] = useState<ListedProject[]>([]);

  async function press(feature: (typeof sampleActions)[number]["feature"]) {
    setResult("呼び出しています。");
    const outcome = await runAction(feature, persona, projects ?? []);
    if (outcome.projects) setProjects(outcome.projects);
    setResult(outcome.text);
    onChanged();
  }

  return (
    <div className="grid gap-4">
      <section className="grid content-start gap-3 rounded-xl border p-4">
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
            onPress={() => setResult("こちらは見本です。API の呼び出しは、下のこのユーザーの画面で試します。")}
          />
        ))}
      </section>

      <section className="grid content-start gap-3 rounded-xl border p-4">
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
        <pre className="min-h-16 overflow-auto rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{result}</pre>
      </section>
    </div>
  );
}
