import { ImageResponse } from "next/og";
import fs from "fs/promises";
import path from "path";
import { models, providers } from "@/lib/models.config";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const contentType = "image/png";
export const size = { width: 1800, height: 945 };
export const alt =
  "Agentic Coding Arena by Logic — Compare frontier AI models on identical coding challenges";

const COLOR_MAP: Record<string, string> = {
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
  "bg-blue-600": "#2563eb",
  "bg-yellow-600": "#ca8a04",
  "bg-purple-600": "#9333ea",
  "bg-sky-600": "#0284c7",
  "bg-indigo-600": "#4f46e5",
  "bg-zinc-700": "#3f3f46",
  "bg-teal-600": "#0d9488",
  "bg-cyan-600": "#0891b2",
  "bg-emerald-600": "#059669",
  "bg-slate-500": "#64748b",
  "bg-fuchsia-600": "#c026d3",
  "bg-violet-600": "#7c3aed",
  "bg-amber-600": "#d97706",
};

const BG = "#040c28";
const BG_ELEVATED = "#07204f";
const FG = "#ebe9fa";
const FG_MUTED = "rgba(235, 233, 250, 0.65)";
const ACCENT = "#b9b4ee";

// Render at 1.5× the standard 1200×630 OG size for crispness after platform downsampling.
const SCALE = 1.5;
const s = (n: number) => Math.round(n * SCALE);

// Deterministic 32-bit integer hash. Cheap decorrelator for our starfield positions.
function hash32(n: number): number {
  let h = n | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

async function loadFont(file: string): Promise<Buffer> {
  return fs.readFile(path.join(process.cwd(), "public", "fonts", file));
}

export default async function OpengraphImage() {
  const [playfair, playfairItalic, workSans] = await Promise.all([
    loadFont("PlayfairDisplay-SemiBold.ttf"),
    loadFont("PlayfairDisplay-SemiBoldItalic.ttf"),
    loadFont("WorkSans-Medium.ttf"),
  ]);

  const modelCount = models.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BG,
          backgroundImage: `radial-gradient(ellipse at 80% 110%, ${BG_ELEVATED} 0%, ${BG} 60%)`,
          padding: `${s(64)}px ${s(72)}px`,
          fontFamily: "Work Sans",
          color: FG,
          position: "relative",
        }}
      >
        {/* Starfield */}
        <div
          style={{
            position: "absolute",
            top: s(120),
            left: s(120),
            right: s(120),
            bottom: s(120),
            display: "flex",
          }}
        >
          {Array.from({ length: 60 }).map((_, i) => {
            // Independent hashes for x and y so they don't correlate into lines.
            const hx = hash32(i * 2 + 1);
            const hy = hash32(i * 2 + 2);
            const hs = hash32(i * 2 + 3);
            const x = (hx % 10000) / 100;
            const y = (hy % 10000) / 100;
            const dotSize = s(3 + (hs % 3));
            const opacity = 0.15 + ((hs % 100) / 100) * 0.5;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  backgroundColor: ACCENT,
                  opacity,
                }}
              />
            );
          })}
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <svg viewBox="0 0 579.1 154.1" width={s(210)} height={s(56)} fill={FG}>
            <g transform="translate(12 12) scale(0.146)">
              <path d="M884 0H580.125L475.15 104.975V408.85H779.025L884 302.033V0Z" />
              <path d="M232.05 0H103.133L0 108.658V884L784.55 885.842L884 782.708V653.792H233.892L232.05 0Z" />
            </g>
            <path d="M225.7,38.8v57.9h40.2v18.7h-64.4V38.8h24.2Z" />
            <path d="M470.9,38.8h24.2v76.5h-24.2V38.8Z" />
            <path d="M541.6,38.8h37.1v20.8h-28c-9.6,0-17.4,7.9-17.4,17.5s7.8,17.5,17.4,17.5h28v20.7h-37.1c-18.5,0-33.6-15.1-33.6-33.9v-8.7c0-18.8,15.1-33.9,33.6-33.9Z" />
            <path
              fillRule="evenodd"
              d="M275.1,77.1c0-22.5,19.6-41.3,44.6-41.3s44.6,18.8,44.6,41.3-19.6,41.3-44.6,41.3-44.6-18.8-44.6-41.3ZM300.4,77.1c0,10.7,8.6,19.4,19.3,19.4s19.3-8.7,19.3-19.4-8.6-19.4-19.3-19.4-19.3,8.7-19.3,19.4Z"
            />
            <path d="M407.4,38.7h46.7v20.8h-37.7c-9.6,0-17.4,7.9-17.4,17.5s7.8,17.5,17.4,17.5h16.4v-18.5h21.2v39.2h-46.7c-18.5,0-33.6-15.1-33.6-33.9v-8.7c0-18.8,15.1-33.9,33.6-33.9Z" />
          </svg>
          <div
            style={{
              marginLeft: "auto",
              fontFamily: "Work Sans",
              fontSize: s(15),
              fontWeight: 500,
              color: FG_MUTED,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Agentic Coding Arena
          </div>
        </div>

        {/* Middle: headline + subhead */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontFamily: "Playfair Display",
              fontSize: s(88),
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: FG,
              display: "flex",
            }}
          >
            Compare
          </div>
          <div
            style={{
              fontFamily: "Playfair Display",
              fontSize: s(88),
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: FG,
              display: "flex",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display",
                fontStyle: "italic",
                color: ACCENT,
              }}
            >
              {modelCount}
            </span>
            <span>&#x2002;frontier models,</span>
          </div>
          <div
            style={{
              fontFamily: "Playfair Display",
              fontSize: s(88),
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: FG,
              display: "flex",
            }}
          >
            side by side.
          </div>
          <div
            style={{
              marginTop: s(28),
              fontFamily: "Work Sans",
              fontSize: s(24),
              color: FG_MUTED,
              display: "flex",
            }}
          >
            52 prompts · one-shot implementations · no editing, no cherry-picking
          </div>
        </div>

        {/* Footer: provider dot rows */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: s(28),
            zIndex: 1,
          }}
        >
          {providers.map((p) => {
            const groupModels = models.filter((m) => m.provider === p.id);
            return (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center", gap: s(10) }}
              >
                <span
                  style={{
                    fontFamily: "Work Sans",
                    fontSize: s(13),
                    fontWeight: 500,
                    color: FG_MUTED,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                  }}
                >
                  {p.name}
                </span>
                <div style={{ display: "flex", gap: s(6) }}>
                  {groupModels.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        width: s(12),
                        height: s(12),
                        borderRadius: "50%",
                        backgroundColor: COLOR_MAP[m.color] ?? ACCENT,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <div
            style={{
              marginLeft: "auto",
              fontFamily: "Work Sans",
              fontSize: s(16),
              color: FG_MUTED,
              display: "flex",
            }}
          >
            arena.logic.inc
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Playfair Display", data: playfair, weight: 600, style: "normal" },
        { name: "Playfair Display", data: playfairItalic, weight: 600, style: "italic" },
        { name: "Work Sans", data: workSans, weight: 500, style: "normal" },
      ],
    }
  );
}
