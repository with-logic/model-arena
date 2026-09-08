"use client";

import { MODELS } from "@/lib/models";
import { getAppStats, formatBytes, formatNumber } from "@/lib/stats";
import type { AppModelStats } from "@/lib/stats.types";
import { getModelHex } from "./stats-mini-chart";

interface StatsComparisonPanelProps {
  appId: string;
  selectedModels: string[];
}

const SUMMARY_ROWS: {
  label: string;
  value: (stats: AppModelStats) => string;
}[] = [
  {
    label: "Estimated lines",
    value: (stats) => formatNumber(stats.lines.total),
  },
  { label: "File size", value: (stats) => formatBytes(stats.sizeBytes) },
  { label: "Gzipped size", value: (stats) => formatBytes(stats.gzipBytes) },
  {
    label: "Gzip / original size",
    value: (stats) => `${(stats.gzipRatio * 100).toFixed(1)}%`,
  },
  { label: "DOM tags", value: (stats) => formatNumber(stats.dom.tagCount) },
  {
    label: "Maximum nesting depth",
    value: (stats) => formatNumber(stats.dom.maxNestingDepth),
  },
  {
    label: "Unique HTML tags",
    value: (stats) => formatNumber(stats.dom.uniqueTags),
  },
  { label: "Comments", value: (stats) => formatNumber(stats.comments.total) },
  {
    label: "External dependencies",
    value: (stats) => formatNumber(stats.externalDeps.total),
  },
  {
    label: "CSS variables",
    value: (stats) => formatNumber(stats.extras.cssVariables),
  },
  {
    label: "Animations",
    value: (stats) => formatNumber(stats.extras.animations),
  },
  {
    label: "Unique colors",
    value: (stats) => formatNumber(stats.extras.uniqueColors),
  },
];

const LANGUAGES = [
  { key: "html", label: "HTML", color: "#8395b5" },
  { key: "css", label: "CSS", color: "#345fe9" },
  { key: "js", label: "JavaScript", color: "#d69a35" },
] as const;

export function StatsComparisonPanel({
  appId,
  selectedModels,
}: StatsComparisonPanelProps) {
  const appStats = getAppStats(appId);
  const activeModels = selectedModels.flatMap((id) => {
    const model = MODELS.find((item) => item.id === id);
    return model ? [model] : [];
  });
  const maxLines = Math.max(
    0,
    ...activeModels.map(
      (model) => appStats?.models[model.id]?.lines.total ?? 0,
    ),
  );

  if (activeModels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--arena-muted)]">
        Choose models to compare their generated code.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--arena-bg)] text-[var(--arena-ink)]">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--arena-accent)]">
            App metrics
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Implementation metrics
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--arena-muted)]">
            Code size and structure for your selected models. These are
            measurements of the generated files, not scores for design,
            functionality, or quality.
          </p>
        </div>
        {!appStats && (
          <p
            role="status"
            className="rounded-none border border-[var(--arena-line)] bg-[var(--arena-panel)] p-4 text-sm text-[var(--arena-muted)]"
          >
            Measurements are not available for this app yet.
          </p>
        )}
        <section
          className="rounded-none border border-[var(--arena-line)] bg-[var(--arena-panel)] p-5 sm:p-6"
          aria-label="Code composition by model"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Code composition</h3>
              <p className="mt-1 text-xs text-[var(--arena-muted)]">
                Estimated lines · same scale across models
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-[var(--arena-muted)]">
              {LANGUAGES.map((language) => (
                <span
                  key={language.key}
                  className="inline-flex items-center gap-1.5"
                >
                  <span
                    className="h-2 w-2 rounded-none"
                    style={{ backgroundColor: language.color }}
                    aria-hidden="true"
                  />
                  {language.label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-6 space-y-6">
            {activeModels.map((model) => {
              const measured = appStats?.models[model.id];
              return (
                <div
                  key={model.id}
                  className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6"
                >
                  <div className="flex items-start gap-2 text-sm font-medium">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-none"
                      style={{ backgroundColor: getModelHex(model.color) }}
                      aria-hidden="true"
                    />
                    {model.name}
                  </div>
                  {measured ? (
                    <div>
                      <div
                        className="flex h-3 overflow-hidden rounded-none bg-[var(--arena-raised)]"
                        aria-hidden="true"
                      >
                        {LANGUAGES.map((language) => (
                          <span
                            key={language.key}
                            style={{
                              backgroundColor: language.color,
                              width: `${maxLines > 0 ? (measured.lines[language.key] / maxLines) * 100 : 0}%`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-5 gap-y-1 text-xs tabular-nums text-[var(--arena-muted)]">
                        <span className="font-medium text-[var(--arena-ink)]">
                          {formatNumber(measured.lines.total)} total
                        </span>
                        <span>
                          {LANGUAGES.map(
                            (language) =>
                              `${language.label} ${formatNumber(measured.lines[language.key])}`,
                          ).join(" · ")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--arena-muted)]">
                      Measurements unavailable
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section
          className="overflow-hidden rounded-none border border-[var(--arena-line)] bg-[var(--arena-panel)]"
          aria-label="Detailed app measurements"
        >
          <div className="border-b border-[var(--arena-line)] px-5 py-4 sm:px-6">
            <h3 className="font-semibold">Measurements</h3>
          </div>
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="App measurements, scroll horizontally for more models"
            tabIndex={0}
          >
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Generated code measurements for the selected models. Missing
                measurements are labeled unavailable.
              </caption>
              <thead className="bg-[var(--arena-bg)]">
                <tr>
                  <th
                    scope="col"
                    className="min-w-48 px-5 py-4 text-left text-xs font-medium text-[var(--arena-muted)] sm:pl-6"
                  >
                    Measurement
                  </th>
                  {activeModels.map((model) => (
                    <th
                      key={model.id}
                      scope="col"
                      className="min-w-40 px-5 py-4 text-right text-xs font-semibold"
                    >
                      {model.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SUMMARY_ROWS.map((row) => (
                  <tr
                    key={row.label}
                    className="border-t border-[var(--arena-line)] hover:bg-[var(--arena-raised)]"
                  >
                    <th
                      scope="row"
                      className="px-5 py-3 text-left font-normal text-[var(--arena-muted)] sm:pl-6"
                    >
                      {row.label}
                    </th>
                    {activeModels.map((model) => {
                      const measured = appStats?.models[model.id];
                      return (
                        <td
                          key={model.id}
                          className="px-5 py-3 text-right tabular-nums"
                        >
                          {measured ? (
                            row.value(measured)
                          ) : (
                            <span className="text-xs text-[var(--arena-muted)]">
                              Unavailable
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--arena-line)] bg-[var(--arena-bg)] px-5 py-4 text-xs leading-5 text-[var(--arena-muted)] sm:px-6">
            Estimated lines account for both formatting and logical code
            boundaries. Gzipped size measures compression of the generated file;
            it does not include external assets or dependencies.
          </p>
        </section>
      </div>
    </div>
  );
}
