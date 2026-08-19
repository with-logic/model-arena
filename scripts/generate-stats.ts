import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { publishedModels } from "../lib/models.config";
import type {
  AppModelStats,
  AppStats,
  ModelAggregate,
  StatsData,
} from "../lib/stats.types";

const APPS_DIR = path.join(process.cwd(), "public", "apps");
const OUTPUT_FILE = path.join(process.cwd(), "lib", "stats.data.json");

// ── Metric extractors ────────────────────────────────────────────

/**
 * Count *logical* lines rather than physical (newline-delimited) ones.
 *
 * Many models emit minified or near-single-line HTML — an entire stylesheet
 * or script can live on one physical line. Splitting on "\n" then measures the
 * model's newline habits, not how much code it wrote (e.g. a 20KB terse app
 * counting as ~45 "CSS lines"). Instead we segment the source into CSS
 * (<style> contents), JS (<script> contents), and HTML (everything else), and
 * for each count semantic units: CSS/JS statement & block boundaries (`;`, `{`,
 * `}`), HTML by opening tags. We take max(physical, logical) per section so
 * already-formatted code keeps its real line count and minified code gets a
 * fair logical count instead of collapsing toward 1.
 */
function countLines(src: string): AppModelStats["lines"] {
  const blank = src.split("\n").filter((l) => l.trim() === "").length;

  // Physical line count for a chunk (fallback for formatted code).
  const physical = (s: string) =>
    s.split("\n").filter((l) => l.trim() !== "").length;

  // Logical statements/rules in CSS or JS: count `;`, `{`, `}` boundaries.
  // Strip string/comment contents first so punctuation inside them isn't
  // counted; this is an approximation, not a parser, but is stable across
  // minified and pretty-printed code.
  const logicalCode = (s: string) => {
    const stripped = s
      .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
      .replace(/\/\/[^\n]*/g, "") // line comments (JS)
      .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, ""); // string literals
    return (stripped.match(/[;{}]/g) || []).length;
  };

  // Logical HTML "lines": one per opening tag.
  const logicalHtml = (s: string) => (s.match(/<[a-zA-Z][^>]*>/g) || []).length;

  const cssBlocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (m) => m[1]
  );
  const jsBlocks = [
    ...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1]);
  const htmlOnly = src
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  const css = cssBlocks.reduce(
    (sum, b) => sum + Math.max(physical(b), logicalCode(b)),
    0
  );
  const js = jsBlocks.reduce(
    (sum, b) => sum + Math.max(physical(b), logicalCode(b)),
    0
  );
  const html = Math.max(physical(htmlOnly), logicalHtml(htmlOnly));

  return { total: html + css + js, html, css, js, blank };
}

function countComments(src: string): AppModelStats["comments"] {
  const htmlComments = (src.match(/<!--[\s\S]*?-->/g) || []).length;

  // Extract CSS blocks
  const cssBlocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (m) => m[1]
  );
  const cssComments = cssBlocks.reduce(
    (sum, block) => sum + (block.match(/\/\*[\s\S]*?\*\//g) || []).length,
    0
  );

  // Extract JS blocks
  const jsBlocks = [
    ...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1]);
  const jsComments = jsBlocks.reduce((sum, block) => {
    const singleLine = (block.match(/\/\/[^\n]*/g) || []).length;
    const multiLine = (block.match(/\/\*[\s\S]*?\*\//g) || []).length;
    return sum + singleLine + multiLine;
  }, 0);

  return {
    html: htmlComments,
    css: cssComments,
    js: jsComments,
    total: htmlComments + cssComments + jsComments,
  };
}

function analyzeDom(
  src: string
): AppModelStats["dom"] {
  // Count all HTML tags (opening tags only)
  const tags = src.match(/<([a-zA-Z][a-zA-Z0-9-]*)/g) || [];
  const tagNames = tags.map((t) => t.slice(1).toLowerCase());
  const tagCount = tagNames.length;
  const uniqueTags = new Set(tagNames).size;

  // Approximate nesting depth by tracking open/close
  let depth = 0;
  let maxDepth = 0;
  // Only count body content for nesting — strip style/script
  const bodyContent = src
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/?>/g;
  const voidElements = new Set([
    "area","base","br","col","embed","hr","img","input",
    "link","meta","param","source","track","wbr",
  ]);
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(bodyContent)) !== null) {
    const full = match[0];
    const tagName = match[1].toLowerCase();
    if (voidElements.has(tagName) || full.endsWith("/>")) continue;
    if (full.startsWith("</")) {
      depth = Math.max(0, depth - 1);
    } else {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    }
  }

  return { tagCount, uniqueTags, maxNestingDepth: maxDepth };
}

function countExternalDeps(
  src: string
): AppModelStats["externalDeps"] {
  const scripts = (
    src.match(/<script[^>]+src\s*=\s*["']https?:\/\//gi) || []
  ).length;
  const stylesheets = (
    src.match(/<link[^>]+href\s*=\s*["']https?:\/\/[^"']*\.css/gi) || []
  ).length;
  const fonts = (
    src.match(
      /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net/gi
    ) || []
  ).length;
  return { scripts, stylesheets, fonts, total: scripts + stylesheets + fonts };
}

function countExtras(
  src: string
): AppModelStats["extras"] {
  // CSS variables
  const cssBlocks = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (m) => m[1]
  );
  const allCss = cssBlocks.join("\n");
  const cssVariables = (allCss.match(/--[a-zA-Z][\w-]*/g) || []).length;

  // Unique colors: hex, rgb, hsl, oklch, named colors in CSS
  const colorPatterns = [
    ...allCss.matchAll(/#(?:[0-9a-fA-F]{3,8})\b/g),
    ...allCss.matchAll(/rgba?\([^)]+\)/g),
    ...allCss.matchAll(/hsla?\([^)]+\)/g),
    ...allCss.matchAll(/oklch\([^)]+\)/g),
  ];
  const uniqueColors = new Set(colorPatterns.map((m) => m[0].toLowerCase()))
    .size;

  // Media queries
  const mediaQueries = (allCss.match(/@media\s/g) || []).length;

  // Animations (keyframes + animation/transition properties)
  const keyframes = (allCss.match(/@keyframes\s/g) || []).length;
  const animationProps = (
    allCss.match(/animation(-name)?:\s*[^;]+/g) || []
  ).length;
  const animations = keyframes + animationProps;

  // SVG & canvas
  const svgCount = (src.match(/<svg[\s>]/gi) || []).length;
  const canvasCount = (src.match(/<canvas[\s>]/gi) || []).length;

  return {
    cssVariables,
    uniqueColors,
    mediaQueries,
    animations,
    svgCount,
    canvasCount,
  };
}

function analyzeFile(filePath: string): AppModelStats | null {
  try {
    const src = fs.readFileSync(filePath, "utf-8");
    const sizeBytes = Buffer.byteLength(src, "utf-8");
    const gzipBytes = zlib.gzipSync(src).length;
    const gzipRatio = sizeBytes > 0 ? gzipBytes / sizeBytes : 0;

    return {
      sizeBytes,
      gzipBytes,
      gzipRatio: Math.round(gzipRatio * 1000) / 1000,
      lines: countLines(src),
      comments: countComments(src),
      dom: analyzeDom(src),
      externalDeps: countExternalDeps(src),
      extras: countExtras(src),
    };
  } catch {
    return null;
  }
}

// ── Aggregation ──────────────────────────────────────────────────

function computeSpread(
  values: number[],
  decimals: number = 0
): { avg: number; min: number; max: number; stdDev: number } {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, stdDev: 0 };
  const n = values.length;
  const avg = values.reduce((a, b) => a + b, 0) / n;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const r = 10 ** decimals;
  return {
    avg: Math.round(avg * r) / r,
    min: Math.round(min * r) / r,
    max: Math.round(max * r) / r,
    stdDev: Math.round(stdDev * r) / r,
  };
}

function computeModelAggregate(
  modelId: string,
  appStatsMap: Record<string, AppStats>
): ModelAggregate {
  const entries: AppModelStats[] = [];
  for (const app of Object.values(appStatsMap)) {
    if (app.models[modelId]) entries.push(app.models[modelId]);
  }

  const spread = (fn: (s: AppModelStats) => number, decimals = 0) =>
    computeSpread(entries.map(fn), decimals);

  return {
    modelId,
    totalApps: entries.length,
    sizeBytes: spread((s) => s.sizeBytes),
    gzipBytes: spread((s) => s.gzipBytes),
    gzipRatio: spread((s) => s.gzipRatio, 3),
    lines: spread((s) => s.lines.total),
    cssLines: spread((s) => s.lines.css),
    jsLines: spread((s) => s.lines.js),
    htmlLines: spread((s) => s.lines.html),
    comments: spread((s) => s.comments.total),
    domTags: spread((s) => s.dom.tagCount),
    uniqueTags: spread((s) => s.dom.uniqueTags),
    nestingDepth: spread((s) => s.dom.maxNestingDepth),
  };
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  console.log("Generating stats...\n");

  const modelIds = publishedModels.map((m) => m.id);
  const appStatsMap: Record<string, AppStats> = {};
  const appIdSet = new Set<string>();

  for (const model of publishedModels) {
    const modelDir = path.join(APPS_DIR, model.id);
    if (!fs.existsSync(modelDir)) {
      console.warn(`  Skipping ${model.id}: no directory found`);
      continue;
    }

    const appDirs = fs
      .readdirSync(modelDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const appDir of appDirs) {
      const htmlPath = path.join(modelDir, appDir.name, "index.html");
      if (!fs.existsSync(htmlPath)) continue;

      const appId = appDir.name;
      appIdSet.add(appId);

      if (!appStatsMap[appId]) {
        appStatsMap[appId] = { appId, models: {} };
      }

      const stats = analyzeFile(htmlPath);
      if (stats) {
        appStatsMap[appId].models[model.id] = stats;
      }
    }

    console.log(
      `  ${model.name}: ${appDirs.length} apps analyzed`
    );
  }

  // Aggregates
  const modelAggregates: Record<string, ModelAggregate> = {};
  for (const modelId of modelIds) {
    modelAggregates[modelId] = computeModelAggregate(modelId, appStatsMap);
  }

  const appIds = [...appIdSet].sort();

  const data: StatsData = {
    generatedAt: new Date().toISOString(),
    modelIds,
    appIds,
    apps: appStatsMap,
    modelAggregates,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(
    `\nStats written to ${path.relative(process.cwd(), OUTPUT_FILE)}`
  );
  console.log(
    `  ${appIds.length} apps x ${modelIds.length} models = ${appIds.length * modelIds.length} entries`
  );
  const fileSizeKB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
  console.log(`  File size: ${fileSizeKB}KB`);
}

main();
