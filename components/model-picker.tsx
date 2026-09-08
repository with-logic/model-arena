"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X, Check, SlidersHorizontal } from "lucide-react";
import { MODELS, MODELS_BY_PROVIDER } from "@/lib/models";
import { DEFAULT_COMPARISON_MODELS } from "@/lib/models.config";
import { MAX_COMPARISON_MODELS } from "@/lib/arena-state";

export function ModelPicker({
  selectedModels,
  onChange,
  compact = false,
  single = false,
}: {
  selectedModels: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const matching = MODELS_BY_PROVIDER.map((group) => ({
    ...group,
    models: group.models.filter(
      (m) =>
        (provider === "all" || provider === group.id) &&
        `${m.name} ${group.name}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
  })).filter((group) => group.models.length);
  function toggle(id: string) {
    if (single) {
      onChange([id]);
      setOpen(false);
      return;
    }
    if (selectedModels.includes(id)) {
      if (selectedModels.length > 1)
        onChange(selectedModels.filter((m) => m !== id));
    } else if (selectedModels.length < MAX_COMPARISON_MODELS)
      onChange([...selectedModels, id]);
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="arena-button arena-button-secondary"
        aria-label={
          single
            ? `Change model, ${MODELS.find((model) => model.id === selectedModels[0])?.name}`
            : `Choose models, ${selectedModels.length} selected`
        }
      >
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span className="arena-picker-trigger-label">
          {single
            ? MODELS.find((model) => model.id === selectedModels[0])?.name
            : compact
              ? "Models"
              : "Choose models"}
        </span>
        {!single && (
          <span className="arena-count">{selectedModels.length}</span>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="arena-dialog-overlay" />
        <Dialog.Content className="arena-model-dialog">
          <div className="flex items-start justify-between gap-4 p-5 pb-3">
            <div>
              <Dialog.Title className="text-xl font-semibold text-[var(--arena-ink)]">
                {single ? "Choose a model" : "Your comparison"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--arena-muted)]">
                {single
                  ? "Keep the app. Change the model."
                  : "Choose 1–4 models. Your selection follows you across the Arena."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="arena-icon-button"
              aria-label="Close model picker"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          <div className="px-5 pb-4">
            {!single && (
              <div
                className="mb-4 flex flex-wrap gap-2"
                aria-label="Selected models"
              >
                {selectedModels.map((id) => {
                  const m = MODELS.find((m) => m.id === id)!;
                  return (
                    <button
                      key={id}
                      onClick={() => toggle(id)}
                      disabled={selectedModels.length === 1}
                      aria-label={`Remove ${m.name}`}
                      className="arena-model-chip"
                    >
                      <span className={`h-2 w-2 rounded-none ${m.color}`} />
                      {m.name}
                      <X size={13} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}
            <label className="arena-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search all models</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${MODELS.length} models…`}
              />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--arena-muted)]">
              <label>
                Provider{" "}
                <select
                  aria-label="Filter models by provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="ml-2 rounded-none border border-[var(--arena-line)] bg-[var(--arena-panel)] px-2 py-1.5 text-[var(--arena-ink)]"
                >
                  <option value="all">All providers</option>
                  {MODELS_BY_PROVIDER.filter((g) => g.models.length).map(
                    (g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {!single && (
                <span role="status">
                  {selectedModels.length === MAX_COMPARISON_MODELS
                    ? "Remove a model to add another"
                    : `${selectedModels.length} of ${MAX_COMPARISON_MODELS} selected`}
                </span>
              )}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border-y border-[var(--arena-line)] px-3 py-2">
            {matching.map((group) => (
              <section key={group.id} aria-label={group.name} className="mb-3">
                <h3 className="px-3 py-2 text-xs font-semibold text-[var(--arena-muted)]">
                  {group.name}{" "}
                  <span className="font-normal">/ {group.models.length}</span>
                </h3>
                {group.models.map((m) => {
                  const selected = selectedModels.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      aria-pressed={selected}
                      disabled={
                        !single &&
                        (selected
                          ? selectedModels.length === 1
                          : selectedModels.length >= MAX_COMPARISON_MODELS)
                      }
                      className="arena-model-option"
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-none ${m.color}`}
                      />
                      <span className="flex-1 text-left">{m.name}</span>
                      <span
                        className={`arena-checkbox ${selected ? "is-checked" : ""}`}
                      >
                        {selected && <Check size={13} />}
                      </span>
                    </button>
                  );
                })}
              </section>
            ))}
            {!matching.length && (
              <p className="p-8 text-center text-sm text-[var(--arena-muted)]">
                No models match. Try another name or provider.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            {!single && (
              <button
                onClick={() => onChange([...DEFAULT_COMPARISON_MODELS])}
                className="arena-text-button"
              >
                Use featured models
              </button>
            )}
            <Dialog.Close className="arena-button arena-button-primary">
              Done
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
