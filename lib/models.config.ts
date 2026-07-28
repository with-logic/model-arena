export type Provider = "openai" | "anthropic" | "google" | "moonshot" | "z-ai" | "qwen" | "xai" | "meta" | "thinking-machines";

export interface ProviderConfig {
  id: Provider;
  name: string;
}

export const providers: ProviderConfig[] = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google" },
  { id: "moonshot", name: "Moonshot AI" },
  { id: "z-ai", name: "Z.ai" },
  { id: "qwen", name: "Qwen" },
  { id: "xai", name: "xAI" },
  { id: "meta", name: "Meta" },
  { id: "thinking-machines", name: "Thinking Machines" },
];

export interface ModelConfig {
  /** Unique identifier used in URLs and file paths (e.g., "gpt-5.1") */
  id: string;

  /** Display name shown in the UI (e.g., "GPT-5.1") */
  name: string;

  /** CLI tool to invoke (e.g., "claude", "codex", "gemini", "anthropic-proxy", "openrouter") */
  cli: "claude" | "codex" | "gemini" | "anthropic-proxy" | "openrouter";

  /** Model identifier passed to the CLI tool (e.g., "opus", "gpt-5.1", "gemini-3") */
  model: string;

  /** Tailwind CSS class for the model's color indicator */
  color: string;

  /** Provider that owns this model */
  provider: Provider;

  /** Whether the model accepts image inputs (default: true). Set false to disallow screenshot tools. */
  supportsVision?: boolean;
}

export const models: ModelConfig[] = [
  {
    id: "gpt-5",
    name: "GPT-5",
    cli: "codex",
    model: "gpt-5",
    color: "bg-emerald-500",
    provider: "openai",
  },
  {
    id: "gpt-5.1",
    name: "GPT-5.1",
    cli: "codex",
    model: "gpt-5.1",
    color: "bg-teal-500",
    provider: "openai",
  },
    {
    id: "gpt-5.2",
    name: "GPT-5.2",
    cli: "codex",
    model: "gpt-5.2",
    color: "bg-cyan-500",
    provider: "openai",
  },
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    cli: "codex",
    model: "gpt-5.3-codex",
    color: "bg-indigo-500",
    provider: "openai",
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    cli: "codex",
    model: "gpt-5.4",
    color: "bg-sky-500",
    provider: "openai",
  },
  {
    id: "gpt-5.5",
    name: "GPT-5.5",
    cli: "codex",
    model: "gpt-5.5",
    color: "bg-blue-600",
    provider: "openai",
  },
  {
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    cli: "codex",
    model: "gpt-5.6-sol",
    color: "bg-teal-600",
    provider: "openai",
  },
  {
    id: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    cli: "codex",
    model: "gpt-5.6-terra",
    color: "bg-cyan-600",
    provider: "openai",
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    cli: "codex",
    model: "gpt-5.6-luna",
    color: "bg-emerald-600",
    provider: "openai",
  },
  {
    id: "opus-4.1",
    name: "Opus 4.1",
    cli: "claude",
    model: "claude-opus-4-1",
    color: "bg-amber-500",
    provider: "anthropic",
  },
  {
    id: "opus-4.5",
    name: "Opus 4.5",
    cli: "claude",
    model: "claude-opus-4-5",
    color: "bg-orange-500",
    provider: "anthropic",
  },
  {
    id: "opus-4.6",
    name: "Opus 4.6",
    cli: "claude",
    model: "claude-opus-4-6",
    color: "bg-red-500",
    provider: "anthropic",
  },
  {
    id: "opus-4.7",
    name: "Opus 4.7",
    cli: "claude",
    model: "claude-opus-4-7",
    color: "bg-pink-500",
    provider: "anthropic",
  },
  {
    id: "opus-4.8",
    name: "Opus 4.8",
    cli: "claude",
    model: "claude-opus-4-8",
    color: "bg-yellow-600",
    provider: "anthropic",
  },
  {
    id: "opus-5",
    name: "Opus 5",
    cli: "claude",
    model: "claude-opus-5",
    color: "bg-amber-600",
    provider: "anthropic",
  },
  {
    id: "sonnet-4.5",
    name: "Sonnet 4.5",
    cli: "claude",
    model: "claude-sonnet-4-5",
    color: "bg-purple-500",
    provider: "anthropic",
  },
  {
    id: "sonnet-4.6",
    name: "Sonnet 4.6",
    cli: "claude",
    model: "claude-sonnet-4-6",
    color: "bg-violet-500",
    provider: "anthropic",
  },
  {
    id: "sonnet-5",
    name: "Sonnet 5",
    cli: "claude",
    model: "claude-sonnet-5",
    color: "bg-indigo-600",
    provider: "anthropic",
  },
  {
    id: "haiku-4.5",
    name: "Haiku 4.5",
    cli: "claude",
    model: "claude-haiku-4-5",
    color: "bg-rose-500",
    provider: "anthropic",
  },
  {
    id: "gemini-3",
    name: "Gemini 3",
    cli: "gemini",
    model: "gemini-3-pro-preview",
    color: "bg-blue-500",
    provider: "google",
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    cli: "gemini",
    model: "gemini-3-flash-preview",
    color: "bg-yellow-500",
    provider: "google",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    cli: "gemini",
    model: "gemini-3.5-flash",
    color: "bg-lime-500",
    provider: "google",
  },
  {
    id: "kimi-k2.6",
    name: "Kimi K2.6",
    cli: "anthropic-proxy",
    model: "accounts/fireworks/models/kimi-k2p6",
    color: "bg-fuchsia-500",
    provider: "moonshot",
  },
  {
    id: "kimi-k2.7-coding",
    name: "Kimi K2.7 Coding",
    cli: "anthropic-proxy",
    model: "accounts/fireworks/models/kimi-k2p7-code",
    color: "bg-purple-600",
    provider: "moonshot",
  },
  {
    id: "kimi-k3",
    name: "Kimi K3",
    cli: "openrouter",
    model: "moonshotai/kimi-k3",
    color: "bg-fuchsia-600",
    provider: "moonshot",
  },
  {
    id: "qwen-3.7-plus",
    name: "Qwen 3.7 Plus",
    cli: "anthropic-proxy",
    model: "accounts/fireworks/models/qwen3p7-plus",
    color: "bg-sky-600",
    provider: "qwen",
    supportsVision: false,
  },
  {
    id: "glm-5.2",
    name: "GLM-5.2",
    cli: "anthropic-proxy",
    model: "accounts/fireworks/models/glm-5p2",
    color: "bg-green-600",
    provider: "z-ai",
    supportsVision: false,
  },
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    cli: "openrouter",
    model: "x-ai/grok-4.5",
    color: "bg-zinc-700",
    provider: "xai",
  },
  {
    id: "muse-spark-1.1",
    name: "Muse Spark 1.1",
    cli: "openrouter",
    model: "meta/muse-spark-1.1",
    color: "bg-violet-600",
    provider: "meta",
  },
  {
    id: "inkling",
    name: "Inkling",
    cli: "anthropic-proxy",
    // Fireworks DEDICATED deployment — Inkling isn't on Serverless/OpenRouter yet.
    // The 52 committed apps are static and don't need this at runtime, but any
    // (re)generation does. The deployment is spun down between runs and comes
    // back under a NEW id each time, so this string is stale as soon as it's off.
    // Before running generate.ts for inkling, update it to the current deployment id.
    model: "accounts/logic-inc/deployments/vpscp78b",
    color: "bg-slate-500",
    provider: "thinking-machines",
  },
];

/** Default models shown in the side-by-side comparison view */
export const DEFAULT_COMPARISON_MODELS = ["opus-5", "kimi-k3", "muse-spark-1.1"] as const;

/** Helper to get a model by ID */
export function getModel(id: string): ModelConfig | undefined {
  return models.find((m) => m.id === id);
}

/** Get the output directory for a model's apps */
export function getModelAppsDir(modelId: string): string {
  return `public/apps/${modelId}`;
}

/** Get the output path for a specific app */
export function getAppOutputPath(modelId: string, appId: string): string {
  return `public/apps/${modelId}/${appId}/index.html`;
}
