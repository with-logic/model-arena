"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getAppStats } from "@/lib/stats";
import { MODELS } from "@/lib/models";
import { getModelHex } from "@/lib/model-colors";


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
