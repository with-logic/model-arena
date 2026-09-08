import {
  DEFAULT_COMPARISON_MODELS,
  DEFAULT_EXPLORER_MODEL,
} from "./models.config";
import { MODEL_IDS } from "./models";

export const MAX_COMPARISON_MODELS = 4;
export const SELECTION_STORAGE_KEY = "arena-models-v1";

export type ArenaPage = "explore" | "models" | "stats";
export interface ArenaLocation {
  page: ArenaPage;
  appId?: string;
  expanded: boolean;
  models: string[];
  view: "side-by-side" | "tabs";
  tab: string;
  content: "demo" | "stats";
  q: string;
  category: string;
}
export function normalizeModels(value: unknown): string[] {
  const valid = Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string => typeof id === "string" && MODEL_IDS.has(id),
          ),
        ),
      ].slice(0, MAX_COMPARISON_MODELS)
    : [];
  return valid.length ? valid : [...DEFAULT_COMPARISON_MODELS];
}
export const DEFAULT_LOCATION: ArenaLocation = {
  page: "explore",
  expanded: false,
  models: [...DEFAULT_COMPARISON_MODELS],
  view: "tabs",
  tab: DEFAULT_EXPLORER_MODEL,
  content: "demo",
  q: "",
  category: "all",
};
export function parseArenaLocation(
  pathname: string,
  search: string,
  remembered?: string[],
): ArenaLocation {
  const params = new URLSearchParams(search);
  const match = pathname.match(/^\/compare\/([^/]+)\/?$/);
  const page = params.get("page");
  const useExplorerDefaults =
    !match && page !== "models" && page !== "stats" && !params.has("models");
  const models = normalizeModels(
    params.has("models")
      ? params.get("models")!.split(",")
      : useExplorerDefaults
        ? DEFAULT_COMPARISON_MODELS
        : remembered,
  );
  let appId: string | undefined = params.get("app") || undefined;
  try {
    if (match) appId = decodeURIComponent(match[1]);
  } catch {
    appId = match?.[1];
  }
  const tab = params.get("tab");
  return {
    page: page === "models" || page === "stats" ? page : "explore",
    ...(appId ? { appId } : {}),
    expanded: Boolean(match),
    models,
    view:
      params.get("view") === "side-by-side"
        ? "side-by-side"
        : params.get("view") === "tabs"
          ? "tabs"
          : match
            ? "side-by-side"
            : "tabs",
    tab: tab && models.includes(tab) ? tab : models[0],
    content: params.get("content") === "stats" ? "stats" : "demo",
    q: params.get("q") || "",
    category: params.get("category") || "all",
  };
}
export function buildArenaUrl(location: ArenaLocation): string {
  const p = new URLSearchParams();
  if (location.appId && !location.expanded) p.set("app", location.appId);
  p.set("models", location.models.join(","));
  if (location.page !== "explore") p.set("page", location.page);
  p.set("view", location.view);
  if (location.tab !== location.models[0] || location.view === "tabs")
    p.set("tab", location.tab);
  if (location.content === "stats") p.set("content", location.content);
  if (location.q) p.set("q", location.q);
  if (location.category !== "all") p.set("category", location.category);
  return `${location.appId && location.expanded ? `/compare/${encodeURIComponent(location.appId)}` : "/"}?${p}`;
}
