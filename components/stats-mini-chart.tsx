"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getAppStats } from "@/lib/stats";
import { MODELS } from "@/lib/models";

/** Map Tailwind bg classes to hex for recharts */
const TW_HEX: Record<string, string> = {
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
  "bg-slate-500": "#64748b",
  "bg-fuchsia-600": "#c026d3",
  "bg-violet-600": "#7c3aed",
  "bg-amber-600": "#d97706",
};

export function getModelHex(color: string): string {
  return TW_HEX[color] || "#6b7280";
}

interface StatsMiniChartProps {
  appId: string;
}

export function StatsMiniChart({ appId }: StatsMiniChartProps) {
  const data = useMemo(() => {
    const appStats = getAppStats(appId);
    if (!appStats) return [];

    return MODELS.filter((m) => appStats.models[m.id]).map((m) => {
      const s = appStats.models[m.id];
      return {
        name: m.name,
        id: m.id,
        html: s.lines.html,
        css: s.lines.css,
        js: s.lines.js,
        fill: getModelHex(m.color),
      };
    });
  }, [appId]);

  if (data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">
        No stats
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="name" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            fontSize: 11,
            background: "#fff",
            border: "1px solid #e5e5e5",
            borderRadius: 0,
            padding: "6px 8px",
          }}
          formatter={(value: number, name: string) => [
            `${value} lines`,
            name.toUpperCase(),
          ]}
          labelFormatter={(label: string) => label}
        />
        <Bar dataKey="html" stackId="lines" fill="#a3a3a3" name="html" radius={0} />
        <Bar dataKey="css" stackId="lines" fill="#6366f1" name="css" radius={0} />
        <Bar dataKey="js" stackId="lines" fill="#f59e0b" name="js" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
