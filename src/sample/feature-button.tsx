"use client";

import { Button } from "@/components/ui/button";
import type { FeatureState } from "@/lib/authz/contract";
import { featureStateLabel } from "@/lib/labels";

export function FeatureButton({
  label,
  call,
  state,
  onPress,
}: {
  label: string;
  call: string;
  state: FeatureState;
  onPress?: () => void;
}) {
  if (state === "hidden") {
    return (
      <div className="flex h-14 items-center justify-between gap-3 rounded-lg border border-dashed px-3 text-sm text-muted-foreground">
        <span>{label}</span>
        <span>非表示</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="grid gap-0.5">
        <Button type="button" disabled={state === "disabled"} onClick={onPress}>
          {label}
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{call}</span>
      </div>
      <span className="text-sm text-muted-foreground">{featureStateLabel[state]}</span>
    </div>
  );
}
