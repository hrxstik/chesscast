"use client";

import { Text } from "@/components/ui/typography";
import type { EnginePvRow } from "@/lib/hooks/useEngine";

type Props = {
  pvRows: EnginePvRow[];
  bestLine?: string;
  /** Не показывать линии (мат / пат / ничья). */
  hidden?: boolean;
};

/** Линии Stockfish — как на странице ведения трансляции. */
export function EngineAnalysisLines({ pvRows, bestLine = "", hidden }: Props) {
  if (hidden) {
    return (
      <Text className="text-xs text-muted-foreground">Партия завершена</Text>
    );
  }

  const rows = pvRows.filter(
    (r) => r.scoreLabel && r.scoreLabel !== "…" && r.pv && r.pv !== "none",
  );

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        rows.map((row) => (
          <div
            key={row.rank}
            className="rounded-md border border-border/60 bg-muted/20 p-2"
          >
            <Text className="text-xs text-muted-foreground">
              Линия {row.rank}
            </Text>
            <Text className="mt-0.5 truncate font-mono text-[10px]! leading-tight sm:text-[12px]!">
              <span className="text-foreground">{row.scoreLabel}</span>
              {row.pv ? ` ${row.pv}` : ""}
            </Text>
          </div>
        ))
      ) : (
        <Text className="truncate font-mono text-[10px] leading-tight text-muted-foreground sm:text-[12px]">
          {bestLine || "—"}
        </Text>
      )}
    </div>
  );
}
