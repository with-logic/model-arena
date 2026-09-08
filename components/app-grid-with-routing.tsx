"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ArrowRight,
  Search,
  LayoutGrid,
  Layers3,
  ChartNoAxesCombined,
  X,
  ExternalLink,
} from "lucide-react";
import type { CodeExample } from "@/lib/code-examples";
import { MODELS, MODELS_BY_PROVIDER } from "@/lib/models";
import { DEFAULT_COMPARISON_MODELS } from "@/lib/models.config";
import { stats, getModelAggregate } from "@/lib/stats";
import {
  buildArenaUrl,
  MAX_COMPARISON_MODELS,
  DEFAULT_LOCATION,
  normalizeModels,
  parseArenaLocation,
  SELECTION_STORAGE_KEY,
  type ArenaLocation,
  type ArenaPage,
} from "@/lib/arena-state";
import * as Dialog from "@radix-ui/react-dialog";
import { Brandmark } from "./brandmark";
import { ModelPicker } from "./model-picker";
import { AppComparisonView } from "./app-comparison-view";
import { StatsModelDashboard } from "./stats-model-card";

const groups = MODELS_BY_PROVIDER.filter((g) => g.models.length);
const featuredSet = new Set<string>(DEFAULT_COMPARISON_MODELS);

const categoryLabels: Record<string, string> = {
  game: "Games",
  tool: "Tools",
  interactive: "Interactive",
  website: "Websites",
  creative: "Creative",
  educational: "Learning",
};
const navigation: { id: ArenaPage; label: string; icon: typeof LayoutGrid }[] =
  [
    { id: "explore", label: "Explore apps", icon: LayoutGrid },
    { id: "models", label: "Models", icon: Layers3 },
    { id: "stats", label: "Stats", icon: ChartNoAxesCombined },
  ];
function ordinaryClick(e: MouseEvent<HTMLAnchorElement>) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function AppGridWithRouting({ apps }: { apps: CodeExample[] }) {
  const [location, setLocation] = useState<ArenaLocation>(DEFAULT_LOCATION);
  const [ready, setReady] = useState(false);
  const [modelProvider, setModelProvider] = useState("all");
  const openedFromGallery = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const collectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    function read() {
      let remembered: string[] | undefined;
      try {
        remembered = normalizeModels(
          JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY) || "null"),
        );
      } catch {
        /* A share link works even when storage is unavailable. */
      }
      const next = parseArenaLocation(
        window.location.pathname,
        window.location.search,
        remembered,
      );
      if (locationRef.current.appId && !next.appId) {
        next.models = locationRef.current.models;
        next.tab = next.models.includes(next.tab) ? next.tab : next.models[0];
        window.history.replaceState({}, "", buildArenaUrl(next));
      }
      if (!next.appId) openedFromGallery.current = false;
      setLocation(next);
      setReady(true);
    }
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          SELECTION_STORAGE_KEY,
          JSON.stringify(location.models),
        );
      } catch {
        /* Selection still lives in the URL. */
      }
    }
  }, [ready, location.models]);
  useEffect(() => {
    if (!location.appId) {
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
  }, [location.appId]);
  function navigate(next: ArenaLocation, replace = false) {
    const url = buildArenaUrl(next);
    if (url === buildArenaUrl(locationRef.current)) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setLocation(next);
  }
  function chooseModels(ids: string[]) {
    const models = normalizeModels(ids);
    const current = locationRef.current;
    navigate(
      {
        ...current,
        models,
        tab: models.includes(current.tab) ? current.tab : models[0],
      },
      true,
    );
  }
  function changePage(page: ArenaPage) {
    navigate({ ...location, page, appId: undefined, q: "", category: "all" });
  }
  function openApp(app: CodeExample, e?: MouseEvent<HTMLAnchorElement>) {
    if (e && !ordinaryClick(e)) return;
    e?.preventDefault();
    returnFocus.current =
      e?.currentTarget ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    openedFromGallery.current = true;
    navigate({ ...location, appId: app.id, content: "demo" });
  }
  function closeApp() {
    if (openedFromGallery.current) {
      openedFromGallery.current = false;
      window.history.back();
    } else
      navigate(
        { ...location, appId: undefined, page: "explore", content: "demo" },
        true,
      );
  }
  function exploreModel(id: string) {
    navigate({
      ...location,
      models: [id],
      tab: id,
      page: "explore",
      q: "",
      category: "all",
      appId: undefined,
    });
    requestAnimationFrame(() =>
      collectionRef.current?.scrollIntoView({ block: "start" }),
    );
  }
  const activeApp = apps.find((app) => app.id === location.appId);
  const categories = useMemo(
    () => [...new Set(apps.flatMap((a) => a.tags))].sort(),
    [apps],
  );
  const filteredApps = useMemo(
    () =>
      apps.filter(
        (app) =>
          (location.category === "all" ||
            app.tags.includes(location.category)) &&
          `${app.title} ${app.tags.join(" ")} ${app.prompt}`
            .toLowerCase()
            .includes(location.q.trim().toLowerCase()),
      ),
    [apps, location.category, location.q],
  );
  const appHref = (app: CodeExample) =>
    buildArenaUrl({ ...location, appId: app.id, content: "demo" });
  const directoryModels = MODELS.filter(
    (m) =>
      (modelProvider === "all" || m.provider === modelProvider) &&
      `${m.name} ${groups.find((g) => g.id === m.provider)?.name}`
        .toLowerCase()
        .includes(location.q.toLowerCase()),
  ).sort(
    (a, b) => Number(featuredSet.has(b.id)) - Number(featuredSet.has(a.id)),
  );

  return (
    <div className="arena-shell">
      <a href="#arena-collection" className="arena-skip">
        Skip to the collection
      </a>
      <header className="arena-header">
        <div className="arena-header-inner">
          <a
            href={buildArenaUrl({
              ...location,
              appId: undefined,
              page: "explore",
              q: "",
              category: "all",
            })}
            onClick={(e) => {
              if (ordinaryClick(e)) {
                e.preventDefault();
                changePage("explore");
                window.scrollTo({ top: 0 });
              }
            }}
            className="arena-brand"
          >
            <Brandmark size={29} fill="var(--arena-accent)" />
            <span>
              Arena<span className="arena-byline">by Logic</span>
            </span>
          </a>
          <nav aria-label="Main navigation" className="arena-nav">
            {navigation.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={buildArenaUrl({
                  ...location,
                  page: id,
                  appId: undefined,
                  q: "",
                  category: "all",
                })}
                aria-current={location.page === id ? "page" : undefined}
                onClick={(e) => {
                  if (ordinaryClick(e)) {
                    e.preventDefault();
                    changePage(id);
                  }
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>
          <a
            className="arena-source"
            href="https://github.com/with-logic/model-arena"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      </header>

      <main className="arena-main" id="arena-main">
        <section
          className="arena-collection"
          id="arena-collection"
          ref={collectionRef}
        >
          {location.page === "explore" ? (
            <h1 className="sr-only">Arena app comparisons</h1>
          ) : (
            <div className="arena-section-heading">
              <h1>
                {location.page === "models" ? "Models" : "Code statistics"}
              </h1>
            </div>
          )}

          <div className="arena-shortlist">
            <div className="arena-shortlist-models">
              <span className="arena-shortlist-label">Comparing</span>
              {location.models.map((id) => {
                const m = MODELS.find((m) => m.id === id)!;
                return (
                  <span className="arena-model-chip" key={id}>
                    <span className={`h-2 w-2 rounded-full ${m.color}`} />
                    {m.name}
                    {location.models.length > 1 && (
                      <button
                        aria-label={`Remove ${m.name} from comparison`}
                        onClick={() =>
                          chooseModels(location.models.filter((x) => x !== id))
                        }
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <ModelPicker
              selectedModels={location.models}
              onChange={chooseModels}
            />
          </div>

          {location.page === "explore" && (
            <>
              <div className="arena-gallery-tools">
                <label className="arena-search">
                  <Search size={18} aria-hidden="true" />
                  <span className="sr-only">Search apps</span>
                  <input
                    value={location.q}
                    onChange={(e) =>
                      navigate({ ...location, q: e.target.value }, true)
                    }
                    placeholder="Search apps, ideas, or features…"
                  />
                  {location.q && (
                    <button
                      onClick={() => navigate({ ...location, q: "" }, true)}
                      aria-label="Clear app search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
                <span className="arena-result-count" role="status">
                  {filteredApps.length} of {apps.length} apps
                </span>
              </div>
              <div
                className="arena-categories"
                aria-label="Filter apps by category"
              >
                <button
                  aria-pressed={location.category === "all"}
                  onClick={() =>
                    navigate({ ...location, category: "all" }, true)
                  }
                >
                  All apps <span>{apps.length}</span>
                </button>
                {categories.map((tag) => (
                  <button
                    key={tag}
                    aria-pressed={location.category === tag}
                    onClick={() =>
                      navigate({ ...location, category: tag }, true)
                    }
                  >
                    {categoryLabels[tag] || tag}
                    <span>
                      {apps.filter((a) => a.tags.includes(tag)).length}
                    </span>
                  </button>
                ))}
              </div>
              {filteredApps.length ? (
                <div className="arena-gallery">
                  {filteredApps.map((app) => (
                    <a
                      key={app.id}
                      href={appHref(app)}
                      onClick={(e) => openApp(app, e)}
                      className="arena-app-card"
                    >
                      <div className="arena-app-image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={app.poster}
                          alt=""
                          loading="lazy"
                          width={600}
                          height={360}
                          onError={(e) => {
                            e.currentTarget.style.visibility = "hidden";
                          }}
                        />
                        <span className="arena-open-label">
                          Compare app
                          <ArrowRight size={15} />
                        </span>
                      </div>
                      <div className="arena-app-info">
                        <div className="arena-app-meta">
                          <span>
                            {app.tags
                              .map((tag) => categoryLabels[tag] || tag)
                              .join(" / ") || "App"}
                          </span>
                          <span>
                            {
                              Object.keys(
                                stats.apps[app.id]?.models || {},
                              ).filter((id) => MODELS.some((m) => m.id === id))
                                .length
                            }{" "}
                            models
                          </span>
                        </div>
                        <h3>{app.title}</h3>
                        <p>
                          {app.prompt.match(/Goal:\s*([^\n]+)/)?.[1] ||
                            app.prompt.split("\n")[0]}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="arena-empty">
                  <h3>No apps match those filters.</h3>
                  <p>Try a different search or explore the full collection.</p>
                  <button
                    className="arena-button arena-button-secondary"
                    onClick={() =>
                      navigate({ ...location, q: "", category: "all" }, true)
                    }
                  >
                    Show all apps
                  </button>
                </div>
              )}
            </>
          )}

          {location.page === "models" && (
            <>
              <div className="arena-gallery-tools">
                <label className="arena-search">
                  <Search size={18} aria-hidden="true" />
                  <span className="sr-only">Search model directory</span>
                  <input
                    value={location.q}
                    onChange={(e) =>
                      navigate({ ...location, q: e.target.value }, true)
                    }
                    placeholder="Find a model or provider…"
                  />
                </label>
                <label className="arena-provider-filter">
                  <span className="sr-only">Provider</span>
                  <select
                    value={modelProvider}
                    onChange={(e) => setModelProvider(e.target.value)}
                  >
                    <option value="all">All providers</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="arena-directory-count" role="status">
                {directoryModels.length} models. Featured comparisons first;
                every generation is available.
              </p>
              <div className="arena-model-directory">
                {directoryModels.map((m) => (
                  <article key={m.id} className="arena-directory-row">
                    <span className={`arena-model-swatch ${m.color}`} />
                    <div className="arena-directory-name">
                      <span>
                        {groups.find((g) => g.id === m.provider)?.name}
                      </span>
                      <h3>{m.name}</h3>
                      <p>
                        {getModelAggregate(m.id)?.totalApps || 0} apps
                        {featuredSet.has(m.id) ? " · Featured comparison" : ""}
                      </p>
                    </div>
                    <div className="arena-directory-actions">
                      <button
                        className="arena-text-button"
                        onClick={() => exploreModel(m.id)}
                      >
                        Explore apps
                        <ArrowRight size={15} />
                      </button>
                      <button
                        className="arena-add-model"
                        aria-pressed={location.models.includes(m.id)}
                        disabled={
                          location.models.includes(m.id)
                            ? location.models.length === 1
                            : location.models.length === MAX_COMPARISON_MODELS
                        }
                        onClick={() =>
                          chooseModels(
                            location.models.includes(m.id)
                              ? location.models.filter((id) => id !== m.id)
                              : [...location.models, m.id],
                          )
                        }
                      >
                        {location.models.includes(m.id)
                          ? "Selected"
                          : "Compare"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!directoryModels.length && (
                <div className="arena-empty">
                  <h3>No models match.</h3>
                  <button
                    className="arena-text-button"
                    onClick={() => {
                      setModelProvider("all");
                      navigate({ ...location, q: "" }, true);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          )}
          {location.page === "stats" && (
            <StatsModelDashboard
              selectedModels={location.models}
              onExploreModel={exploreModel}
            />
          )}
        </section>
        <footer className="arena-footer">
          <p>
            Arena / Model evaluation
            <br />
            <span>
              {MODELS.length} models · {apps.length} shared challenges
            </span>
          </p>
          <div>
            <a
              href="https://github.com/with-logic/model-arena/tree/main/examples"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the prompts
            </a>
            <a
              href="https://logic.inc"
              target="_blank"
              rel="noopener noreferrer"
            >
              Made by Logic
            </a>
          </div>
        </footer>
      </main>
      {ready && activeApp && (
        <AppComparisonView
          app={activeApp}
          apps={apps}
          location={location}
          onChange={(next) => navigate(next, true)}
          onModelsChange={chooseModels}
          onClose={closeApp}
        />
      )}
      {ready && location.appId && !activeApp && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) closeApp();
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="arena-workspace-overlay" />
            <Dialog.Content className="arena-not-found">
              <Dialog.Title>That app isn’t in the collection.</Dialog.Title>
              <Dialog.Description>
                Browse the collection to find another app to compare.
              </Dialog.Description>
              <button
                className="arena-button arena-button-primary"
                onClick={closeApp}
              >
                Explore all apps
              </button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
