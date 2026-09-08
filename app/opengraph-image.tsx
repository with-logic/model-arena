import { ImageResponse } from "next/og";
import fs from "fs/promises";
import path from "path";
import { Brandmark } from "@/components/brandmark";
import { loadApps } from "@/lib/code-examples";
import { publishedModels } from "@/lib/models.config";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt =
  "Agentic Coding Arena by Logic. A coding benchmark comparing model implementations, generation time, and cost across identical tasks.";

// Match the live collection's palette and compact app-frame chrome.
const colors = {
  background: "#080b10",
  panel: "#151b24",
  line: "#37414d",
  ink: "#eef2f8",
  muted: "#a4b1c3",
  accent: "#b8ed83",
};

// These are actual model renders, also used in the collection's filmstrip.
const featuredApps = ["asteroid-game", "audio-step-sequencer", "csv-to-charts"];
const previewModel = "gpt-6-astra";

export default async function OpengraphImage() {
  const [font, apps, previews] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "public/fonts/WorkSans-Medium.ttf")),
    loadApps(),
    Promise.all(
      featuredApps.map(async (id) => {
        const data = await fs.readFile(
          path.join(
            process.cwd(),
            "public/previews",
            previewModel,
            `${id}.jpg`,
          ),
        );
        return { id, src: `data:image/jpeg;base64,${data.toString("base64")}` };
      }),
    ),
  ]);
  const modelName = publishedModels.find(
    (model) => model.id === previewModel,
  )!.name;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: colors.background,
        color: colors.ink,
        fontFamily: "Work Sans",
        fontWeight: 500,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 82,
          padding: "0 48px",
          borderBottom: `1px solid ${colors.line}`,
        }}
      >
        <Brandmark size={30} fill={colors.ink} />
        <span style={{ marginLeft: 12, fontSize: 28, letterSpacing: -1 }}>
          Arena
        </span>
        <span
          style={{
            marginLeft: 22,
            paddingLeft: 22,
            borderLeft: `1px solid ${colors.line}`,
            fontSize: 19,
            color: colors.muted,
          }}
        >
          Agentic coding
        </span>
        <span style={{ marginLeft: "auto", fontSize: 18, color: colors.muted }}>
          by Logic
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "32px 48px 30px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 64,
            lineHeight: 1.06,
            letterSpacing: -3,
          }}
        >
          <span>Agentic Coding</span>
          <span>Arena</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 360,
            fontSize: 23,
            lineHeight: 1.4,
            color: colors.muted,
          }}
        >
          <span>Compare implementations,</span>
          <span>generation time, and cost.</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginTop: 18,
              fontSize: 17,
              color: colors.accent,
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: colors.accent,
              }}
            />
            <span>
              {publishedModels.length} models / {apps.length} coding tasks
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, padding: "0 48px" }}>
        {previews.map((preview, index) => {
          const title = apps.find((app) => app.id === preview.id)!.title;
          return (
            <div
              key={preview.id}
              style={{
                display: "flex",
                flexDirection: "column",
                width: 357,
                overflow: "hidden",
                border: `1px solid ${index === 0 ? colors.accent : colors.line}`,
                background: colors.panel,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 38,
                  padding: "0 13px",
                  fontSize: 14,
                }}
              >
                <span>{title}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    color: colors.muted,
                    fontSize: 12,
                  }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              {/* ImageResponse embeds local image bytes; no network fetch during export. */}
              <img
                src={preview.src}
                alt={title}
                width={355}
                height={222}
                style={{ objectFit: "cover" }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "auto",
          padding: "0 48px",
          height: 70,
          fontSize: 16,
          color: colors.muted,
        }}
      >
        <span style={{ color: colors.ink }}>Identical prompts</span>
        <span
          style={{
            marginLeft: 18,
            paddingLeft: 18,
            borderLeft: `1px solid ${colors.line}`,
          }}
        >
          Unedited outputs
        </span>
        <span style={{ marginLeft: 18, color: colors.muted }}>
          Previews: {modelName}
        </span>
        <span style={{ marginLeft: "auto", color: colors.accent }}>
          arena.logic.inc
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "Work Sans", data: font, weight: 500, style: "normal" }],
    },
  );
}
