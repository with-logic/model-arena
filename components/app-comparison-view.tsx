"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Square,
  Share2,
  FileText,
  ChartNoAxesCombined,
  MoreHorizontal,
  ExternalLink,
  X,
} from "lucide-react";
import type { CodeExample } from "@/lib/code-examples";
import { buildArenaUrl, type ArenaLocation } from "@/lib/arena-state";
import { MODELS } from "@/lib/models";
import { ModelPicker } from "./model-picker";
import { StatsComparisonPanel } from "./stats-comparison-panel";

export function AppComparisonView({
  app,
  apps,
  location,
  onChange,
  onModelsChange,
  onClose,
}: {
  app: CodeExample;
  apps: CodeExample[];
  location: ArenaLocation;
  onChange: (location: ArenaLocation) => void;
  onModelsChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [narrow, setNarrow] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const [shareUrl, setShareUrl] = useState("");
  const shareRequest = useRef(0);
  const comparisonUrl = buildArenaUrl(location);
  const [promptOpen, setPromptOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const optionsTriggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!optionsOpen) return;
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !optionsRef.current?.contains(event.target)
      )
        setOptionsOpen(false);
    }
    let focusFrame: number | undefined;
    function dismissOnFrameFocus() {
      // Frame pointer events do not bubble to the parent document.
      focusFrame = requestAnimationFrame(() => {
        if (document.activeElement?.tagName === "IFRAME") setOptionsOpen(false);
      });
    }
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("blur", dismissOnFrameFocus);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("blur", dismissOnFrameFocus);
      if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
    };
  }, [optionsOpen]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setShareState("idle");
    return () => {
      shareRequest.current += 1;
    };
  }, [comparisonUrl]);
  useEffect(() => {
    setPromptOpen(false);
  }, [app.id]);
  useEffect(() => {
    if (shareState !== "copied") return;
    const timer = setTimeout(() => setShareState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [shareState]);
  const index = apps.findIndex((a) => a.id === app.id);
  const selected = location.models.flatMap((id) => {
    const model = MODELS.find((m) => m.id === id);
    return model ? [model] : [];
  });
  const split =
    location.view === "side-by-side" && !narrow && selected.length > 1;
  const visible = split
    ? selected
    : selected.filter((m) => m.id === location.tab);
  function focusModel(id: string) {
    const returnToSplit =
      location.view === "tabs" && location.tab === id && selected.length > 1;
    onChange({
      ...location,
      tab: id,
      ...(!narrow
        ? {
            view: returnToSplit ? ("side-by-side" as const) : ("tabs" as const),
          }
        : {}),
    });
  }
  async function share() {
    const request = ++shareRequest.current;
    const url = window.location.href;
    const isCurrent = () =>
      request === shareRequest.current && window.location.href === url;
    setShareState("idle");
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      if (isCurrent()) setShareState("copied");
    } catch {
      if (isCurrent()) setShareState("manual");
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="arena-workspace-overlay" />
        <Dialog.Content
          className="arena-workspace"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (optionsOpen) {
              event.preventDefault();
              setOptionsOpen(false);
              optionsTriggerRef.current?.focus();
            }
          }}
        >
          <Dialog.Title className="sr-only">Compare {app.title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Models appear from left to right in the order shown in the toolbar.
            Focus on a model to use a full-width app. Comparison options contain
            model selection, statistics, the prompt, and sharing.
          </Dialog.Description>
          <header className="arena-comparison-bar">
            <button
              onClick={onClose}
              className="arena-back arena-icon-button"
              aria-label="Back to collection"
              title="Back to collection"
            >
              <ArrowLeft size={17} />
              <span className="sr-only">Collection</span>
            </button>
            <div className="arena-app-navigation">
              <button
                className="arena-icon-button arena-step-app"
                aria-label="Previous app"
                disabled={index <= 0}
                onClick={() =>
                  onChange({ ...location, appId: apps[index - 1].id })
                }
              >
                <ChevronLeft size={15} />
              </button>
              <label>
                <span className="sr-only">Choose an app</span>
                <select
                  value={app.id}
                  onChange={(e) =>
                    onChange({ ...location, appId: e.target.value })
                  }
                >
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="arena-icon-button arena-step-app"
                aria-label="Next app"
                disabled={index >= apps.length - 1}
                onClick={() =>
                  onChange({ ...location, appId: apps[index + 1].id })
                }
              >
                <ChevronRight size={15} />
              </button>
            </div>
            {narrow ? (
              <label className="arena-focused-model">
                <span className="sr-only">Active model</span>
                <select
                  value={location.tab}
                  onChange={(e) => focusModel(e.target.value)}
                >
                  {selected.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div
                className="arena-workspace-models"
                aria-label="Models, ordered left to right"
              >
                {selected.map((model, i) => (
                  <button
                    key={model.id}
                    aria-pressed={
                      location.content === "stats" ||
                      split ||
                      location.tab === model.id
                    }
                    title={
                      !split && location.tab === model.id && selected.length > 1
                        ? "Return to split view"
                        : `Focus on ${model.name}`
                    }
                    onClick={() => focusModel(model.id)}
                  >
                    <span className={`arena-signal ${model.color}`} />
                    <span className="arena-model-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {model.name}
                  </button>
                ))}
              </div>
            )}
            {!narrow && selected.length > 1 && location.content === "demo" && (
              <button
                className="arena-icon-button"
                aria-label={
                  split ? "Focus on one model" : "Compare side by side"
                }
                title={split ? "Focus on one model" : "Compare side by side"}
                onClick={() =>
                  onChange({
                    ...location,
                    view: split ? "tabs" : "side-by-side",
                  })
                }
              >
                {split ? <Columns2 size={16} /> : <Square size={15} />}
              </button>
            )}
            <div className="arena-bar-picker">
              <ModelPicker
                compact
                selectedModels={location.models}
                onChange={onModelsChange}
              />
            </div>
            <div className="arena-options" ref={optionsRef}>
              <button
                ref={optionsTriggerRef}
                className="arena-icon-button arena-options-trigger"
                aria-label="Comparison options"
                aria-expanded={optionsOpen}
                aria-controls="comparison-options"
                title="Comparison options"
                onClick={() => setOptionsOpen((open) => !open)}
              >
                <MoreHorizontal size={20} />
              </button>
              {optionsOpen && (
                <div
                  id="comparison-options"
                  className="arena-comparison-options"
                  role="group"
                  aria-label="Comparison options"
                >
                  <p className="arena-control-label">Comparison</p>
                  <div
                    className="arena-segment"
                    aria-label="Comparison content"
                  >
                    <button
                      aria-pressed={location.content === "demo"}
                      onClick={() => onChange({ ...location, content: "demo" })}
                    >
                      Live apps
                    </button>
                    <button
                      aria-pressed={location.content === "stats"}
                      onClick={() =>
                        onChange({ ...location, content: "stats" })
                      }
                    >
                      <ChartNoAxesCombined size={14} />
                      Code stats
                    </button>
                  </div>
                  {!narrow && selected.length > 1 && (
                    <div className="arena-segment" aria-label="App layout">
                      <button
                        aria-pressed={location.view === "side-by-side"}
                        onClick={() =>
                          onChange({ ...location, view: "side-by-side" })
                        }
                      >
                        <Columns2 size={14} />
                        Split
                      </button>
                      <button
                        aria-pressed={location.view === "tabs"}
                        onClick={() => onChange({ ...location, view: "tabs" })}
                      >
                        <Square size={13} />
                        Focus
                      </button>
                    </div>
                  )}
                  <button
                    className="arena-option-action"
                    onClick={() => {
                      setOptionsOpen(false);
                      setPromptOpen(true);
                    }}
                  >
                    <FileText size={15} />
                    Shared prompt
                  </button>
                  <button
                    className="arena-option-action arena-share"
                    onClick={share}
                  >
                    <Share2 size={15} />
                    <span role="status">
                      {shareState === "copied" ? "Link copied" : "Share"}
                    </span>
                  </button>
                  <a
                    className="arena-option-action"
                    href={`/apps/${location.tab}/${app.id}/index.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={15} />
                    Open{" "}
                    {
                      selected.find((model) => model.id === location.tab)?.name
                    }{" "}
                    app
                  </a>
                  {shareState === "manual" && (
                    <label className="arena-share-fallback">
                      Copy link
                      <input
                        aria-label="Shareable comparison link"
                        readOnly
                        value={shareUrl}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </header>
          <div className="arena-workspace-body">
            {location.content === "stats" ? (
              <StatsComparisonPanel
                appId={app.id}
                selectedModels={location.models}
              />
            ) : (
              <div
                className={`arena-demo-grid ${split ? "is-split" : ""}`}
                style={
                  split
                    ? {
                        gridTemplateColumns: `repeat(${visible.length}, minmax(340px, 1fr))`,
                      }
                    : undefined
                }
              >
                {visible.map((model) => (
                  <section
                    key={`${app.id}/${model.id}`}
                    className="arena-demo-panel"
                    aria-label={`${model.name} app`}
                  >
                    <div
                      className={`arena-model-edge ${model.color}`}
                      aria-hidden="true"
                    />
                    <iframe
                      src={`/apps/${model.id}/${app.id}/index.html`}
                      title={`${app.title} by ${model.name}`}
                      allow={[
                        app.camera ? "camera" : "",
                        app.microphone ? "microphone" : "",
                        "fullscreen",
                      ]
                        .filter(Boolean)
                        .join("; ")}
                    />
                  </section>
                ))}
              </div>
            )}
          </div>
          <Dialog.Root open={promptOpen} onOpenChange={setPromptOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="arena-dialog-overlay" />
              <Dialog.Content
                className="arena-prompt-dialog"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  optionsTriggerRef.current?.focus();
                }}
              >
                <div className="arena-prompt-heading">
                  <Dialog.Title>Shared prompt / {app.title}</Dialog.Title>
                  <Dialog.Close
                    className="arena-icon-button"
                    aria-label="Close prompt"
                  >
                    <X size={18} />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">
                  Every model receives this same prompt.
                </Dialog.Description>
                <pre>{app.prompt}</pre>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
