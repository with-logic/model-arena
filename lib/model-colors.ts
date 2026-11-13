/**
 * Hex value for every Tailwind class a model may use as its color. Charts need
 * the hex because recharts cannot read Tailwind classes. `ModelConfig.color` is
 * typed from these keys, so a model with an unmapped color fails to compile.
 */
const MODEL_COLOR_HEX = {
  "bg-emerald-500": "#10b981",
  "bg-teal-500": "#14b8a6",
  "bg-cyan-500": "#06b6d4",
  "bg-indigo-500": "#6366f1",
  "bg-sky-500": "#0ea5e9",
  "bg-amber-500": "#f59e0b",
  "bg-orange-500": "#f97316",
  "bg-red-500": "#ef4444",
  "bg-pink-500": "#ec4899",
  "bg-purple-500": "#a855f7",
  "bg-violet-500": "#8b5cf6",
  "bg-rose-500": "#f43f5e",
  "bg-blue-500": "#3b82f6",
  "bg-yellow-500": "#eab308",
  "bg-fuchsia-500": "#d946ef",
  "bg-lime-500": "#84cc16",
  "bg-green-600": "#16a34a",
  "bg-purple-600": "#9333ea",
  "bg-sky-600": "#0284c7",
  "bg-blue-600": "#2563eb",
  "bg-yellow-600": "#ca8a04",
  "bg-indigo-600": "#4f46e5",
  "bg-zinc-700": "#3f3f46",
  "bg-teal-600": "#0d9488",
  "bg-cyan-600": "#0891b2",
  "bg-emerald-600": "#059669",
  "bg-emerald-700": "#047857",
  "bg-cyan-700": "#0e7490",
  "bg-slate-500": "#64748b",
  "bg-fuchsia-600": "#c026d3",
  "bg-violet-600": "#7c3aed",
  "bg-amber-600": "#d97706",
  "bg-teal-700": "#0f766e",
  "bg-sky-700": "#0369a1",
  "bg-orange-600": "#ea580c",
  "bg-rose-600": "#e11d48",
  "bg-violet-700": "#6d28d9",
  "bg-pink-600": "#db2777",
} as const;

export type ModelColor = keyof typeof MODEL_COLOR_HEX;

export function getModelHex(color: ModelColor): string {
  return MODEL_COLOR_HEX[color];
}
