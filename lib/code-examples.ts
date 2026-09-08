import path from "path";
import fs from "fs/promises";
import YAML from "yaml";

export interface CodeExampleYAML {
  id?: string; // optional in YAML—slug will be canonical
  title?: string;
  name?: string; // legacy
  prompt?: string;
  tags?: unknown;
  camera?: unknown;
  microphone?: unknown;
}

export interface CodeExample {
  id: string;
  title: string;
  prompt: string;
  poster: string;
  /** Actual model renders, distinct from the prompt's reference poster. */
  previews?: Record<string, string>;
  iframeUrl: string;
  tags: string[];
  camera?: boolean;
  microphone?: boolean;
}

const IFRAME_BASE_URL = "/";

// --- helpers to normalize YAML fields ---
function toStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value))
    return value.filter((v) => typeof v === "string") as string[];
  return undefined;
}
function toBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

// Build a **plain object** (no class)
function toCodeExample(
  id: string,
  data: Required<Pick<CodeExampleYAML, "title" | "prompt">> & {
    tags?: string[];
    camera?: boolean;
    microphone?: boolean;
  },
): CodeExample {
  return {
    id,
    title: data.title,
    prompt: data.prompt,
    poster: `/posters/${id}.png`,
    iframeUrl: `${IFRAME_BASE_URL}${id}`,
    tags: data.tags ?? [],
    camera: data.camera,
    microphone: data.microphone,
  };
}

export async function loadApps(): Promise<CodeExample[]> {
  // Runs on the server; YAML files are in the examples/ directory at repo root
  const examplesDir = path.join(process.cwd(), "examples");
  const entries = await fs.readdir(examplesDir);
  const previews = await loadPreviews();
  const apps: CodeExample[] = [];

  for (const name of entries) {
    if (!/\.(yaml|yml)$/i.test(name)) continue;
    const file = path.join(examplesDir, name);
    try {
      const raw = await fs.readFile(file, "utf8");
      const obj = YAML.parse(raw) as CodeExampleYAML;

      const slug = name.replace(/\.(yaml|yml)$/i, "");

      const title =
        (typeof obj.title === "string" && obj.title) ||
        (typeof obj.name === "string" && obj.name) ||
        undefined;
      const prompt = typeof obj.prompt === "string" ? obj.prompt : undefined;
      if (!title || !prompt) continue;

      apps.push({
        ...toCodeExample(slug, {
          title,
          prompt,
          tags: toStringArray(obj.tags),
          camera: toBool(obj.camera),
          microphone: toBool(obj.microphone),
        }),
        previews: previews.get(slug),
      });
    } catch {
      // ignore malformed files
    }
  }

  apps.sort((a, b) => a.title.localeCompare(b.title));
  return apps; // ✅ plain objects, safe to pass to Client Components
}

async function loadPreviews(): Promise<Map<string, Record<string, string>>> {
  const previews = new Map<string, Record<string, string>>();
  const directory = path.join(process.cwd(), "public", "previews");
  const models = await fs
    .readdir(directory, { withFileTypes: true })
    .catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });

  // Read each available model directory once, rather than stat every app/model pair.
  for (const model of models) {
    if (!model.isDirectory() || !/^[a-z0-9][a-z0-9.-]*$/.test(model.name))
      continue;
    const files = await fs.readdir(path.join(directory, model.name), {
      withFileTypes: true,
    });
    for (const file of files) {
      if (!file.isFile() || !/^[a-z0-9][a-z0-9-]*\.jpg$/.test(file.name))
        continue;
      const appId = file.name.slice(0, -4);
      const appPreviews = previews.get(appId) ?? {};
      appPreviews[model.name] = `/previews/${model.name}/${file.name}`;
      previews.set(appId, appPreviews);
    }
  }
  return previews;
}
