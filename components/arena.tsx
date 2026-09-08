"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Search,
  LayoutGrid,
  Layers3,
  ChartNoAxesCombined,
  X,
  ExternalLink,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import type { CodeExample } from "@/lib/code-examples";
import { MODELS, MODELS_BY_PROVIDER } from "@/lib/models";
import { DEFAULT_COMPARISON_MODELS } from "@/lib/models.config";
import { getModelAggregate } from "@/lib/stats";
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
import { ordinaryClick } from "@/lib/utils";
import { Brandmark } from "./brandmark";
import { ModelPicker } from "./model-picker";
import { AppCollection } from "./app-collection";
import { StatsModelDashboard } from "./stats-model-card";

const groups = MODELS_BY_PROVIDER.filter((group) => group.models.length);
const featuredSet = new Set<string>(DEFAULT_COMPARISON_MODELS);
const navigation: { id: ArenaPage; label: string; icon: typeof LayoutGrid }[] =
  [
    { id: "explore", label: "Explore apps", icon: LayoutGrid },
    { id: "models", label: "Models", icon: Layers3 },
    { id: "stats", label: "Stats", icon: ChartNoAxesCombined },
  ];

export function Arena({ apps }: { apps: CodeExample[] }) {
  const [location, setLocation] = useState<ArenaLocation>(DEFAULT_LOCATION);
  const [ready, setReady] = useState(false);
  const [modelProvider, setModelProvider] = useState("all");
  const locationRef = useRef(location);
  const expandedFromCollection = useRef(false);
  const returningToCollection = useRef(false);
  locationRef.current = location;
  useEffect(() => {
    function read() {
      returningToCollection.current = false;
      let remembered: string[] | undefined;
      try {
        const saved = JSON.parse(
          localStorage.getItem(SELECTION_STORAGE_KEY) || "null",
        );
        if (Array.isArray(saved)) remembered = normalizeModels(saved);
      } catch {
        /* Direct links work without storage. */
      }
      const next = parseArenaLocation(
        window.location.pathname,
        window.location.search,
        remembered,
      );
      // Returning from the expanded app keeps the app and shortlist currently in use.
      if (
        locationRef.current.expanded &&
        !next.expanded &&
        next.page === "explore"
      ) {
        next.appId = locationRef.current.appId;
        next.models = locationRef.current.models;
        next.tab = locationRef.current.tab;
        next.view = locationRef.current.view;
        next.content = locationRef.current.content;
        window.history.replaceState({}, "", buildArenaUrl(next));
      }
      if (!next.expanded) expandedFromCollection.current = false;
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
        /* The URL remains authoritative. */
      }
    }
  }, [ready, location.models]);
  const navigate = useCallback((next: ArenaLocation, replace = false) => {
    const url = buildArenaUrl(next);
    if (url === buildArenaUrl(locationRef.current)) return;
    window.history[replace ? "replaceState" : "pushState"]({}, "", url);
    setLocation(next);
  }, []);
  const changeLocation = useCallback(
    (next: ArenaLocation) => {
      if (returningToCollection.current) return;
      const current = locationRef.current;
      if (
        current.expanded &&
        !next.expanded &&
        next.page === "explore" &&
        expandedFromCollection.current
      ) {
        expandedFromCollection.current = false;
        returningToCollection.current = true;
        window.history.back();
        return;
      }
      if (!current.expanded && next.expanded)
        expandedFromCollection.current = true;
      navigate(
        next,
        current.expanded === next.expanded && current.page === next.page,
      );
    },
    [navigate],
  );
  function chooseModels(ids: string[]) {
    const models = normalizeModels(ids),
      current = locationRef.current;
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
    navigate({ ...location, page, expanded: false, q: "", category: "all" });
  }
  function exploreModel(id: string) {
    navigate({
      ...location,
      models: [id],
      tab: id,
      view: "tabs",
      content: "demo",
      page: "explore",
      expanded: false,
      q: "",
      category: "all",
    });
  }
  const directoryModels = MODELS.filter(
    (model) =>
      (modelProvider === "all" || model.provider === modelProvider) &&
      `${model.name} ${groups.find((group) => group.id === model.provider)?.name}`
        .toLowerCase()
        .includes(location.q.toLowerCase()),
  ).sort(
    (a, b) => Number(featuredSet.has(b.id)) - Number(featuredSet.has(a.id)),
  );
  const unknownApp =
    location.appId && !apps.some((app) => app.id === location.appId);
  function resetApp() {
    navigate(
      {
        ...location,
        appId: undefined,
        page: "explore",
        expanded: false,
        q: "",
        category: "all",
      },
      true,
    );
  }
  if (!ready)
    return (
      <div className="arena-live">
        <p className="arena-loading" role="status">
          Loading the collection…
        </p>
      </div>
    );
  return (
    <>
      {location.page === "explore" ? (
        <AppCollection
          apps={apps}
          location={location}
          onChange={changeLocation}
          onModelsChange={chooseModels}
        />
      ) : (
        <div className="arena-shell">
          <a href="#arena-collection" className="arena-skip">
            Skip to the collection
          </a>
          <header className="arena-header">
            <div className="arena-header-inner">
              <a
                href={buildArenaUrl({
                  ...location,
                  page: "explore",
                  expanded: false,
                  q: "",
                  category: "all",
                })}
                className="arena-brand"
                onClick={(event) => {
                  if (ordinaryClick(event)) {
                    event.preventDefault();
                    changePage("explore");
                  }
                }}
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
                      expanded: false,
                      q: "",
                      category: "all",
                    })}
                    aria-current={location.page === id ? "page" : undefined}
                    onClick={(event) => {
                      if (ordinaryClick(event)) {
                        event.preventDefault();
                        changePage(id);
                      }
                    }}
                  >
                    <Icon size={16} />
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
                <ExternalLink size={13} />
              </a>
            </div>
          </header>
          <main className="arena-main">
            <section className="arena-collection" id="arena-collection">
              <div className="arena-section-heading">
                <h1>
                  {location.page === "models" ? "Models" : "Code statistics"}
                </h1>
              </div>
              <div className="arena-shortlist">
                <div className="arena-shortlist-models">
                  <span className="arena-shortlist-label">Selected models</span>
                  {location.models.map((id) => (
                    <span className="arena-model-chip" key={id}>
                      {MODELS.find((model) => model.id === id)?.name}
                      {location.models.length > 1 && (
                        <button
                          aria-label={`Remove ${MODELS.find((model) => model.id === id)?.name} from comparison`}
                          onClick={() =>
                            chooseModels(
                              location.models.filter((item) => item !== id),
                            )
                          }
                        >
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <ModelPicker
                  selectedModels={location.models}
                  onChange={chooseModels}
                />
              </div>
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
                            {featuredSet.has(m.id)
                              ? " · Featured comparison"
                              : ""}
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
                                : location.models.length ===
                                  MAX_COMPARISON_MODELS
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
        </div>
      )}
      {unknownApp && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) resetApp();
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
                onClick={resetApp}
              >
                Explore all apps
              </button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
