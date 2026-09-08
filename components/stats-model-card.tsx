"use client";

import { useId, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { MODELS, PROVIDERS } from "@/lib/models";
import { DEFAULT_COMPARISON_MODELS } from "@/lib/models.config";
import { getAllModelAggregates, formatBytes, formatNumber } from "@/lib/stats";
import { getModelHex } from "./stats-mini-chart";
import type { ModelAggregate, MetricSpread } from "@/lib/stats.types";

type MetricKey = Exclude<keyof ModelAggregate, "modelId" | "totalApps">;
const count = (value: number) => formatNumber(Math.round(value));
const METRICS: {
  key: MetricKey;
  label: string;
  format: (value: number) => string;
}[] = [
  { key: "lines", label: "Estimated lines", format: count },
  {
    key: "sizeBytes",
    label: "File size",
    format: (value) => formatBytes(Math.round(value)),
  },
  {
    key: "gzipBytes",
    label: "Gzipped size",
    format: (value) => formatBytes(Math.round(value)),
  },
  {
    key: "gzipRatio",
    label: "Gzip / original size",
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  { key: "domTags", label: "DOM tags", format: count },
  {
    key: "nestingDepth",
    label: "Maximum nesting depth",
    format: (value) => value.toFixed(1),
  },
  { key: "comments", label: "Comments", format: count },
  { key: "uniqueTags", label: "Unique HTML tags", format: count },
  { key: "htmlLines", label: "Estimated HTML lines", format: count },
  { key: "cssLines", label: "Estimated CSS lines", format: count },
  { key: "jsLines", label: "Estimated JavaScript lines", format: count },
];

type SortKey = "name" | "apps" | "average";
interface StatsModelDashboardProps {
  selectedModels?: string[];
  onExploreModel?: (id: string) => void;
}

function measuredSpread(
  aggregate: ModelAggregate | undefined,
  key: MetricKey,
): MetricSpread | undefined {
  const spread = aggregate?.[key];
  return aggregate &&
    aggregate.totalApps > 0 &&
    spread &&
    [spread.avg, spread.min, spread.max].every(Number.isFinite)
    ? spread
    : undefined;
}

export function StatsModelDashboard({
  selectedModels = [...DEFAULT_COMPARISON_MODELS],
  onExploreModel,
}: StatsModelDashboardProps) {
  const controlId = useId();
  const [scope, setScope] = useState<"selected" | "all">("selected");
  const [query, setQuery] = useState("");
  const [metricKey, setMetricKey] = useState<MetricKey>("lines");
  const [sort, setSort] = useState<{
    key: SortKey;
    direction: "ascending" | "descending";
  }>({ key: "name", direction: "ascending" });
  const aggregates = useMemo(
    () =>
      new Map(
        getAllModelAggregates().map((aggregate) => [
          aggregate.modelId,
          aggregate,
        ]),
      ),
    [],
  );
  const metric = METRICS.find((item) => item.key === metricKey)!;
  const rows = MODELS.filter(
    (model) => scope === "all" || selectedModels.includes(model.id),
  )
    .map((model) => ({
      model,
      provider:
        PROVIDERS.find((provider) => provider.id === model.provider)?.name ??
        model.provider,
      aggregate: aggregates.get(model.id),
      spread: measuredSpread(aggregates.get(model.id), metricKey),
    }))
    .filter(({ model, provider }) =>
      `${model.name} ${provider}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const direction = sort.direction === "ascending" ? 1 : -1;
      if (sort.key === "name")
        return a.model.name.localeCompare(b.model.name) * direction;
      const av = sort.key === "apps" ? a.aggregate?.totalApps : a.spread?.avg;
      const bv = sort.key === "apps" ? b.aggregate?.totalApps : b.spread?.avg;
      // Missing measurements always follow measured values, in either direction.
      if (av == null) return bv == null ? 0 : 1;
      if (bv == null) return -1;
      return (av - bv) * direction || a.model.name.localeCompare(b.model.name);
    });
  const maxAverage = Math.max(0, ...rows.map((row) => row.spread?.avg ?? 0));
  const selectedCount = MODELS.filter((model) =>
    selectedModels.includes(model.id),
  ).length;

  function sortBy(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  function sortHeading(key: SortKey, label: string) {
    const Icon =
      sort.key !== key
        ? ArrowUpDown
        : sort.direction === "ascending"
          ? ArrowUp
          : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => sortBy(key)}
        className="inline-flex min-h-10 items-center gap-2 rounded-none text-left hover:text-[var(--arena-accent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--arena-accent)]"
        aria-label={`Sort by ${label}${sort.key === key ? `, currently ${sort.direction}` : ""}`}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-none border border-[var(--arena-line)] bg-[var(--arena-panel)] text-[var(--arena-ink)]"
      aria-labelledby={`${controlId}-heading`}
    >
      <div className="border-b border-[var(--arena-line)] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--arena-accent)]">
              Aggregate metrics
            </p>
            <h2
              id={`${controlId}-heading`}
              className="text-2xl font-semibold tracking-tight"
            >
              Model measurements
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--arena-muted)]">
              Compare code size and structure across the collection. These
              measurements describe the output; they do not score app quality.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-1 rounded-none bg-[var(--arena-raised)] p-1"
            role="group"
            aria-label="Models shown in statistics"
          >
            {(["selected", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-pressed={scope === value}
                className={`min-h-10 rounded-none px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--arena-accent)] ${scope === value ? "bg-[var(--arena-panel)] text-[var(--arena-ink)] " : "text-[var(--arena-muted)] hover:text-[var(--arena-ink)]"}`}
              >
                {value === "selected"
                  ? `Your comparison · ${selectedCount}`
                  : `All models · ${MODELS.length}`}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${controlId}-metric`}
              className="mb-2 block text-xs font-semibold text-[var(--arena-muted)]"
            >
              Measurement
            </label>
            <select
              id={`${controlId}-metric`}
              value={metricKey}
              onChange={(event) =>
                setMetricKey(event.target.value as MetricKey)
              }
              className="h-11 w-full rounded-none border border-[var(--arena-line)] bg-[var(--arena-panel)] px-3 text-sm focus:outline-2 focus:outline-[var(--arena-accent)]"
            >
              {METRICS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`${controlId}-search`}
              className="mb-2 block text-xs font-semibold text-[var(--arena-muted)]"
            >
              Find a model or provider
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--arena-muted)]"
                aria-hidden="true"
              />
              <input
                id={`${controlId}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search models…"
                className="h-11 w-full rounded-none border border-[var(--arena-line)] bg-[var(--arena-panel)] pl-9 pr-3 text-sm focus:outline-2 focus:outline-[var(--arena-accent)]"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 px-5 py-4 text-xs text-[var(--arena-muted)] sm:px-7">
        <p role="status">
          {rows.length} {rows.length === 1 ? "model" : "models"} shown
        </p>
        <p>Per-app averages · range shows minimum to maximum</p>
      </div>
      <div
        className="overflow-x-auto"
        role="region"
        aria-label="Model measurements, scroll horizontally for more columns"
        tabIndex={0}
      >
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <caption className="sr-only">
            {metric.label} by model. Averages and ranges across measured apps.
            Missing data is labeled unavailable.
          </caption>
          <thead className="border-y border-[var(--arena-line)] bg-[var(--arena-bg)] text-xs text-[var(--arena-muted)]">
            <tr>
              <th
                scope="col"
                aria-sort={sort.key === "name" ? sort.direction : "none"}
                className="px-5 py-1 text-left font-medium sm:pl-7"
              >
                {sortHeading("name", "Model")}
              </th>
              <th
                scope="col"
                aria-sort={sort.key === "apps" ? sort.direction : "none"}
                className="px-3 py-1 text-left font-medium"
              >
                {sortHeading("apps", "Apps measured")}
              </th>
              <th
                scope="col"
                aria-sort={sort.key === "average" ? sort.direction : "none"}
                className="w-[30%] min-w-44 px-3 py-1 text-left font-medium"
              >
                {sortHeading(
                  "average",
                  `Average ${metric.label.toLowerCase()}`,
                )}
              </th>
              <th
                scope="col"
                className="px-5 py-3 text-right font-medium sm:pr-7"
              >
                Range
              </th>
              {onExploreModel && (
                <th scope="col" className="pr-5">
                  <span className="sr-only">Explore apps</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ model, provider, aggregate, spread }) => (
              <tr
                key={model.id}
                className="border-b border-[var(--arena-line)] last:border-0 hover:bg-[var(--arena-raised)]"
              >
                <th
                  scope="row"
                  className="px-5 py-5 text-left font-medium sm:pl-7"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-none"
                      style={{ backgroundColor: getModelHex(model.color) }}
                      aria-hidden="true"
                    />
                    {model.name}
                  </div>
                  <div className="ml-[18px] mt-1 text-xs font-normal text-[var(--arena-muted)]">
                    {provider}
                    {scope === "all" && selectedModels.includes(model.id)
                      ? " · In your comparison"
                      : ""}
                  </div>
                </th>
                <td className="px-3 py-5 tabular-nums text-[var(--arena-muted)]">
                  {aggregate
                    ? formatNumber(aggregate.totalApps)
                    : "Unavailable"}
                </td>
                <td className="px-3 py-5 tabular-nums">
                  {spread ? (
                    <>
                      <span>{metric.format(spread.avg)}</span>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-none bg-[var(--arena-raised)]"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-none bg-[var(--arena-accent)]"
                          style={{
                            width: `${maxAverage > 0 ? (spread.avg / maxAverage) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <span className="text-[var(--arena-muted)]">
                      Unavailable
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-5 text-right tabular-nums text-[var(--arena-muted)] sm:pr-7">
                  {spread
                    ? `${metric.format(spread.min)} – ${metric.format(spread.max)}`
                    : "Unavailable"}
                </td>
                {onExploreModel && (
                  <td className="pr-5">
                    <button
                      type="button"
                      onClick={() => onExploreModel(model.id)}
                      aria-label={`Explore apps by ${model.name}`}
                      className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-none text-xs font-medium text-[var(--arena-accent)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--arena-accent)]"
                    >
                      Explore
                      <ArrowUpRight
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="px-5 py-12 text-center text-sm text-[var(--arena-muted)]">
          {query.trim()
            ? "No models match this search in the current view."
            : "Choose models for your comparison, or browse all models."}
          {scope === "selected" && (
            <button
              type="button"
              onClick={() => setScope("all")}
              className="mx-auto mt-3 block min-h-10 rounded-none px-3 font-medium text-[var(--arena-accent)] hover:bg-[var(--arena-raised)]"
            >
              Browse all {MODELS.length} models
            </button>
          )}
        </div>
      )}
      <p className="border-t border-[var(--arena-line)] bg-[var(--arena-bg)] px-5 py-4 text-xs leading-5 text-[var(--arena-muted)] sm:px-7">
        Models may have different app coverage; averages include only measured
        apps. Estimated lines account for both formatting and logical code
        boundaries. Bars share a scale within the current view.
      </p>
    </section>
  );
}
