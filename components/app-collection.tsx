"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Expand,
  Minimize,
  LayoutGrid,
  FileText,
  ChartNoAxesCombined,
  MoreHorizontal,
  Share2,
  ExternalLink,
  X,
} from "lucide-react";
import { ordinaryClick } from "@/lib/utils";
import { Brandmark } from "./brandmark";
import { ModelPicker } from "./model-picker";
import { StatsComparisonPanel } from "./stats-comparison-panel";
import type { CodeExample } from "@/lib/code-examples";
import { MODELS } from "@/lib/models";
import {
  DEFAULT_COMPARISON_MODELS,
  DEFAULT_EXPLORER_MODEL,
} from "@/lib/models.config";
import { buildArenaUrl, type ArenaLocation } from "@/lib/arena-state";

const categories: Record<string, string> = {
  game: "Game",
  interactive: "Interactive",
  app: "App",
  utility: "Utility",
  tool: "Tool",
  landing: "Website",
  creative: "Creative",
  educational: "Learning",
  website: "Website",
};
const modelName = (id: string) =>
  MODELS.find((model) => model.id === id)?.name ?? id;
const appUrl = (app: CodeExample, model: string) =>
  `/apps/${model}/${app.id}/index.html`;

function Preview({
  app,
  model,
  className,
  fallback = false,
}: {
  app: CodeExample;
  model: string;
  className?: string;
  fallback?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = [
    { src: app.previews?.[model], label: `Preview by ${modelName(model)}` },
    ...(fallback
      ? [
          {
            src: app.previews?.[DEFAULT_EXPLORER_MODEL],
            label: `Preview by ${modelName(DEFAULT_EXPLORER_MODEL)}`,
          },
          { src: app.poster, label: "Prompt reference image" },
        ]
      : []),
  ];
  const preview = candidates.find(
    (candidate) => candidate.src && !failed.includes(candidate.src),
  );
  return preview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={preview.src}
      alt=""
      title={preview.label}
      loading="lazy"
      onError={() => setFailed((previous) => [...previous, preview.src!])}
    />
  ) : (
    <div className={`${className ?? ""} preview-placeholder`}>
      <span>{app.title}</span>
      <small>{modelName(model)}</small>
    </div>
  );
}

function AppFrame({
  app,
  model,
  active,
  scaled,
}: {
  app: CodeExample;
  model: string;
  active: boolean;
  scaled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{
    width: number;
    height: number;
    scale: number;
  }>();
  useEffect(() => {
    const element = host.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const resize = () => {
      const width = element.clientWidth,
        height = element.clientHeight;
      if (!width || !height) return;
      const layoutWidth = scaled ? Math.max(1180, width) : width;
      const scale = width / layoutWidth;
      setSize((previous) =>
        previous?.width === layoutWidth &&
        previous.height === height / scale &&
        previous.scale === scale
          ? previous
          : { width: layoutWidth, height: height / scale, scale },
      );
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scaled]);
  return (
    <div ref={host} className="live-surface" inert={!active}>
      <div
        className="frame-scaler"
        style={
          size
            ? {
                width: size.width,
                height: size.height,
                transform: `scale(${size.scale})`,
              }
            : { width: "100%", height: "100%" }
        }
      >
        <iframe
          src={appUrl(app, model)}
          title={`${app.title} by ${modelName(model)}`}
          tabIndex={active ? 0 : -1}
          style={{ pointerEvents: active ? "auto" : "none" }}
          allow={[
            active && app.camera ? "camera" : "",
            active && app.microphone ? "microphone" : "",
            "fullscreen",
          ]
            .filter(Boolean)
            .join("; ")}
        />
      </div>
    </div>
  );
}

function CollectionDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  restoreFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  className: string;
  restoreFocus: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="arena-live-modal-layer">
          <Dialog.Overlay className="arena-dialog-overlay" />
          <Dialog.Content
            className={`arena-live-modal ${className}`}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              restoreFocus();
            }}
          >
            <div className="dialog-heading">
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                <Dialog.Description>{description}</Dialog.Description>
              </div>
              <Dialog.Close
                className="close"
                aria-label={`Close ${className === "collection-dialog" ? "app browser" : "prompt"}`}
              >
                <X size={20} />
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppCollection({
  apps,
  location,
  onChange,
  onModelsChange,
}: {
  apps: CodeExample[];
  location: ArenaLocation;
  onChange: (location: ArenaLocation) => void;
  onModelsChange: (ids: string[]) => void;
}) {
  const [narrow, setNarrow] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const [shareUrl, setShareUrl] = useState("");
  const shareRequest = useRef(0);
  const stageRef = useRef<HTMLElement>(null);
  const optionsRef = useRef<HTMLDetailsElement>(null);
  const filmstripRef = useRef<HTMLElement>(null);
  const indexTriggerRef = useRef<HTMLButtonElement>(null);
  const promptTriggerRef = useRef<HTMLElement | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const collection = useMemo(() => {
    const featured = [
      "asteroid-game",
      "ocean-wave-simulation",
      "audio-step-sequencer",
      "cloud-painter",
    ];
    return [...apps].sort((a, b) => {
      const rank = (id: string) => {
        const index = featured.indexOf(id);
        return index < 0 ? featured.length : index;
      };
      return rank(a.id) - rank(b.id) || a.title.localeCompare(b.title);
    });
  }, [apps]);
  const index = Math.max(
    0,
    collection.findIndex((app) => app.id === location.appId),
  );
  const app = collection[index];
  const [lastDemoApp, setLastDemoApp] = useState(
    location.content === "demo" ? app?.id : undefined,
  );
  const model = location.tab;
  const split = location.view === "side-by-side" && location.models.length > 1;
  const visibleModels = split && !narrow ? location.models : [model];
  const url = buildArenaUrl(location);

  useEffect(() => {
    if (location.content === "demo") setLastDemoApp(app?.id);
  }, [app?.id, location.content]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setShareState("idle");
    return () => {
      shareRequest.current += 1;
    };
  }, [url]);
  useEffect(() => {
    if (shareState !== "copied") return;
    const timer = setTimeout(() => setShareState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [shareState]);
  useEffect(() => {
    const thumb = filmstripRef.current?.querySelector<HTMLElement>(
      '[aria-current="true"]',
    );
    thumb?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [app?.id, model]);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !optionsRef.current?.contains(event.target) &&
        optionsRef.current
      )
        optionsRef.current.open = false;
    }
    let frame: number | undefined;
    function frameFocus() {
      frame = requestAnimationFrame(() => {
        if (document.activeElement?.tagName === "IFRAME" && optionsRef.current)
          optionsRef.current.open = false;
      });
    }
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("blur", frameFocus);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("blur", frameFocus);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        document.querySelector('[role="dialog"],dialog[open]')
      )
        return;
      if (
        event
          .composedPath()
          .some(
            (target) =>
              target instanceof HTMLElement &&
              (target.matches(
                'input,textarea,select,[role="textbox"],[role="slider"],[role="combobox"]',
              ) ||
                target.isContentEditable),
          )
      )
        return;
      if (document.activeElement?.tagName === "IFRAME") return;
      if (optionsRef.current?.open) {
        if (event.key === "Escape") {
          event.preventDefault();
          optionsRef.current.open = false;
          optionsRef.current.querySelector("summary")?.focus();
        }
        return;
      }
      const state = locationRef.current;
      if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        collection.length > 1
      ) {
        event.preventDefault();
        const currentIndex = Math.max(
          0,
          collection.findIndex((item) => item.id === state.appId),
        );
        const next =
          (currentIndex +
            (event.key === "ArrowRight" ? 1 : -1) +
            collection.length) %
          collection.length;
        onChange({ ...state, appId: collection[next].id });
      } else if (event.key === "Escape" && state.expanded) {
        event.preventDefault();
        onChange({ ...state, expanded: false });
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [collection, onChange]);

  if (!app)
    return (
      <div className="arena-empty">
        <h1>No apps are available yet.</h1>
      </div>
    );
  const activeLocation = { ...location, appId: app.id };
  const statisticsLocation: ArenaLocation = {
    ...activeLocation,
    expanded: false,
    page: "stats",
    q: "",
    category: "all",
  };
  function go(next: CodeExample) {
    onChange({ ...activeLocation, appId: next.id });
  }
  function compare() {
    const models =
      location.models.length > 1
        ? location.models
        : [model, DEFAULT_COMPARISON_MODELS.find((id) => id !== model)!];
    onChange({
      ...activeLocation,
      models,
      view: split ? "tabs" : "side-by-side",
      content: "demo",
    });
  }
  function focusModel(id: string) {
    onChange({
      ...activeLocation,
      tab: id,
      view:
        location.view === "tabs" && model === id && location.models.length > 1
          ? "side-by-side"
          : "tabs",
    });
  }
  async function share() {
    const request = ++shareRequest.current;
    const currentUrl = new URL(
      buildArenaUrl(activeLocation),
      window.location.origin,
    ).href;
    const browserUrl = window.location.href;
    const isCurrent = () =>
      request === shareRequest.current && window.location.href === browserUrl;
    setShareState("idle");
    setShareUrl(currentUrl);
    try {
      await navigator.clipboard.writeText(currentUrl);
      if (isCurrent()) setShareState("copied");
    } catch {
      if (isCurrent()) setShareState("manual");
    }
  }
  const matching = collection.filter(
    (item) =>
      (location.category === "all" || item.tags.includes(location.category)) &&
      `${item.title} ${item.prompt} ${item.tags.join(" ")}`
        .toLowerCase()
        .includes(location.q.trim().toLowerCase()),
  );
  const tagList = [...new Set(collection.flatMap((item) => item.tags))].sort();
  // Every card keeps its app/model key across focus, comparison and expansion.
  const cards: {
    app: CodeExample;
    model: string;
    distance: number;
    active: boolean;
    live: boolean;
    column: number;
  }[] = [];
  collection.forEach((item, i) => {
    let distance = i - index;
    if (distance > collection.length / 2) distance -= collection.length;
    if (distance < -collection.length / 2) distance += collection.length;
    if (Math.abs(distance) > 2) return;
    if (distance === 0) {
      location.models.forEach((id) => {
        const column = visibleModels.indexOf(id);
        const active = column >= 0;
        if (active)
          cards.push({
            app: item,
            model: id,
            distance,
            active,
            live: location.content === "demo" || lastDemoApp === item.id,
            column,
          });
      });
    } else if (!split && !location.expanded && location.content === "demo") {
      cards.push({
        app: item,
        model,
        distance,
        active: false,
        live: !narrow && Math.abs(distance) === 1,
        column: -1,
      });
    }
  });

  return (
    <div
      className={`arena-live ${location.expanded ? "expanded" : ""} ${split && !narrow ? "comparing" : ""}`}
    >
      <a className="arena-skip" href="#live-stage">
        Skip to the app
      </a>
      <header className="toolbar">
        <a
          className="brand"
          href={buildArenaUrl({ ...activeLocation, expanded: false })}
          onClick={(event) => {
            if (ordinaryClick(event)) {
              event.preventDefault();
              onChange({ ...activeLocation, expanded: false });
            }
          }}
          aria-label="Arena collection"
        >
          <Brandmark size={21} />
          <span>Arena</span>
        </a>
        <span className="toolbar-divider" />
        <button
          ref={indexTriggerRef}
          className="index-button"
          onClick={() => setIndexOpen(true)}
          aria-label={`Browse apps, ${app.title}, ${index + 1} of ${collection.length}`}
        >
          <LayoutGrid />
          <span className="app-title">{app.title}</span>
          <span className="app-count muted">
            {String(index + 1).padStart(2, "0")} / {collection.length}
          </span>
          <ChevronDown className="chevron" />
        </button>
        <div className="toolbar-right">
          {location.models.length === 1 ? (
            <ModelPicker
              single
              selectedModels={[model]}
              onChange={(ids) =>
                onChange({
                  ...activeLocation,
                  models: ids,
                  tab: ids[0],
                  view: "tabs",
                })
              }
            />
          ) : (
            <>
              {narrow ? (
                <label className="focused-model">
                  <span className="sr-only">Active model</span>
                  <select
                    aria-label="Active model"
                    value={model}
                    onChange={(event) =>
                      onChange({ ...activeLocation, tab: event.target.value })
                    }
                  >
                    {location.models.map((id) => (
                      <option key={id} value={id}>
                        {modelName(id)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="model-tabs" aria-label="Compared models">
                  {location.models.map((id) => (
                    <button
                      className="model-button"
                      key={id}
                      aria-pressed={location.view === "tabs" && id === model}
                      onClick={() => focusModel(id)}
                      title={`Focus ${modelName(id)}; click again to restore split`}
                    >
                      <span
                        className={`status-dot ${id === model ? "" : "secondary"}`}
                      />
                      <span>{modelName(id)}</span>
                    </button>
                  ))}
                </div>
              )}
              <ModelPicker
                compact
                selectedModels={location.models}
                onChange={onModelsChange}
              />
            </>
          )}
          <button
            className="compare-button"
            onClick={compare}
            aria-pressed={split}
            aria-label={split ? "Focus on one model" : "Compare side by side"}
          >
            <Columns2 />
            <span className="button-label">{split ? "Solo" : "Compare"}</span>
          </button>
          <button
            className="expand-button"
            onClick={() =>
              onChange({ ...activeLocation, expanded: !location.expanded })
            }
            aria-label={
              location.expanded ? "Return to collection" : "Fill screen"
            }
            aria-pressed={location.expanded}
          >
            {location.expanded ? <Minimize /> : <Expand />}
            <span className="button-label">
              {location.expanded ? "Return" : "Expand"}
            </span>
          </button>
          <details ref={optionsRef} className="live-options">
            <summary aria-label="App options" title="App options">
              <MoreHorizontal />
            </summary>
            <div className="live-options-menu">
              <button
                onClick={() =>
                  onChange({
                    ...activeLocation,
                    content: location.content === "demo" ? "stats" : "demo",
                  })
                }
              >
                <ChartNoAxesCombined />
                {location.content === "demo" ? "Code stats" : "Live apps"}
              </button>
              <button
                onClick={() => {
                  promptTriggerRef.current =
                    optionsRef.current?.querySelector("summary") ?? null;
                  if (optionsRef.current) optionsRef.current.open = false;
                  setPromptOpen(true);
                }}
              >
                <FileText />
                Shared prompt
              </button>
              <button className="arena-share" onClick={share}>
                <Share2 />
                <span role="status">
                  {shareState === "copied" ? "Link copied" : "Share"}
                </span>
              </button>
              <a
                href={appUrl(app, model)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                Open app in new tab
              </a>
              <a
                href={buildArenaUrl(statisticsLocation)}
                onClick={(event) => {
                  if (ordinaryClick(event)) {
                    event.preventDefault();
                    onChange(statisticsLocation);
                  }
                }}
              >
                <ChartNoAxesCombined />
                Arena statistics
              </a>
              {shareState === "manual" && (
                <label className="share-fallback">
                  Copy link
                  <input
                    aria-label="Shareable comparison link"
                    readOnly
                    value={shareUrl}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              )}
            </div>
          </details>
        </div>
      </header>
      <main
        ref={stageRef}
        id="live-stage"
        className="stage"
        tabIndex={-1}
        aria-label="Live app collection"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) stageRef.current?.focus();
        }}
      >
        <h1 className="sr-only">
          {app.title} by {modelName(model)}
        </h1>
        <div
          className="cards"
          hidden={location.content === "stats"}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) stageRef.current?.focus();
          }}
        >
          {cards.map((card) => (
            <section
              key={`${card.app.id}/${card.model}`}
              data-app={card.app.id}
              data-model={card.model}
              className={`app-card ${card.active ? "active" : Math.abs(card.distance) === 1 ? "side" : "far"}`}
              aria-label={`${card.app.title} by ${modelName(card.model)}`}
              aria-hidden={!card.active}
              style={
                {
                  "--side": Math.sign(card.distance) || 1,
                  ...(split && !narrow && card.active
                    ? {
                        left: `${((card.column + 0.5) * 100) / visibleModels.length}%`,
                        width: `calc(${100 / visibleModels.length}vw - ${location.expanded ? 0 : 20}px)`,
                      }
                    : {}),
                } as CSSProperties
              }
            >
              <Preview
                app={card.app}
                model={card.model}
                className="preview-poster"
              />
              {card.live && (
                <AppFrame
                  app={card.app}
                  model={card.model}
                  active={card.active && location.content === "demo"}
                  scaled={!narrow && !split && !location.expanded}
                />
              )}
              {!card.active && card.distance !== 0 && (
                <button
                  className="preview-shield"
                  tabIndex={-1}
                  onClick={() => go(card.app)}
                  aria-label={`Open ${card.app.title}`}
                >
                  <span>{card.app.title}</span>
                </button>
              )}
            </section>
          ))}
        </div>
        {location.content === "stats" && (
          <div className="live-app-stats">
            <StatsComparisonPanel
              appId={app.id}
              selectedModels={location.models}
            />
          </div>
        )}
        {!split &&
          !location.expanded &&
          location.content === "demo" &&
          collection.length > 1 && (
            <>
              <button
                className="stage-arrow previous"
                aria-label="Previous app"
                onClick={() =>
                  go(
                    collection[
                      (index - 1 + collection.length) % collection.length
                    ],
                  )
                }
              >
                <ChevronLeft />
              </button>
              <button
                className="stage-arrow next"
                aria-label="Next app"
                onClick={() => go(collection[(index + 1) % collection.length])}
              >
                <ChevronRight />
              </button>
            </>
          )}
      </main>
      {!location.expanded && (
        <footer className="collection-footer">
          <div className="collection-details">
            <button
              className="prompt-button"
              onClick={(event) => {
                promptTriggerRef.current = event.currentTarget;
                setPromptOpen(true);
              }}
            >
              <span className="category-label">
                {app.tags.map((tag) => categories[tag] || tag).join(", ")}
              </span>
              <FileText />
              <span>Prompt</span>
            </button>
            <span className="keyboard-hint">
              <kbd>←</kbd>
              <kbd>→</kbd> browse apps
            </span>
            <nav className="collection-links" aria-label="Main navigation">
              <button onClick={() => setIndexOpen(true)}>
                {apps.length} apps
              </button>
              <span>/</span>
              <a
                href={buildArenaUrl({
                  ...activeLocation,
                  page: "models",
                  expanded: false,
                  q: "",
                  category: "all",
                })}
                onClick={(event) => {
                  if (ordinaryClick(event)) {
                    event.preventDefault();
                    onChange({
                      ...activeLocation,
                      page: "models",
                      expanded: false,
                      q: "",
                      category: "all",
                    });
                  }
                }}
              >
                {MODELS.length} models
              </a>
              <a
                aria-label="Arena statistics"
                title="Arena statistics"
                href={buildArenaUrl(statisticsLocation)}
                onClick={(event) => {
                  if (ordinaryClick(event)) {
                    event.preventDefault();
                    onChange(statisticsLocation);
                  }
                }}
              >
                <ChartNoAxesCombined size={14} />
              </a>
            </nav>
          </div>
          <nav
            ref={filmstripRef}
            className="filmstrip"
            aria-label="Choose an app"
          >
            {collection.map((item, i) => (
              <button
                key={item.id}
                className={`thumb ${item.id === app.id ? "active" : ""}`}
                aria-label={`App ${i + 1}: ${item.title}`}
                aria-current={item.id === app.id ? "true" : "false"}
                title={item.title}
                onClick={() => go(item)}
              >
                <Preview app={item} model={model} fallback />
                <span className="thumb-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            ))}
          </nav>
        </footer>
      )}
      <p className="sr-only" aria-live="polite">
        {app.title}. App {index + 1} of {collection.length}. {modelName(model)}.
      </p>
      <CollectionDialog
        open={indexOpen}
        onOpenChange={setIndexOpen}
        restoreFocus={() => indexTriggerRef.current?.focus()}
        title="Explore the collection"
        description={`${collection.length} shared prompts. Viewing ${modelName(model)}.`}
        className="collection-dialog"
      >
        <div className="collection-filters">
          <input
            type="search"
            aria-label="Search apps"
            placeholder="Find an app…"
            value={location.q}
            onChange={(event) =>
              onChange({ ...activeLocation, q: event.target.value })
            }
          />
          <select
            aria-label="Filter apps by category"
            value={location.category}
            onChange={(event) =>
              onChange({ ...activeLocation, category: event.target.value })
            }
          >
            <option value="all">All categories</option>
            {tagList.map((tag) => (
              <option key={tag} value={tag}>
                {categories[tag] || tag}
              </option>
            ))}
          </select>
        </div>
        <div className="app-results">
          {matching.map((item) => (
            <button
              key={item.id}
              className="index-app"
              aria-current={item.id === app.id}
              onClick={() => {
                setIndexOpen(false);
                go(item);
                requestAnimationFrame(() => stageRef.current?.focus());
              }}
            >
              <Preview app={item} model={model} className="index-image" />
              <span className="index-label">
                <span>{item.title}</span>
                <small>
                  {String(collection.indexOf(item) + 1).padStart(2, "0")}
                </small>
              </span>
            </button>
          ))}
          {!matching.length && (
            <div className="empty-results">
              <p>No apps match those filters.</p>
              <button
                onClick={() =>
                  onChange({ ...activeLocation, q: "", category: "all" })
                }
              >
                Show all apps
              </button>
            </div>
          )}
        </div>
      </CollectionDialog>
      <CollectionDialog
        open={promptOpen}
        onOpenChange={setPromptOpen}
        restoreFocus={() => promptTriggerRef.current?.focus()}
        title={app.title}
        description="Shared prompt"
        className="prompt-dialog"
      >
        <p className="prompt-text">{app.prompt}</p>
      </CollectionDialog>
    </div>
  );
}
