#!/usr/bin/env node
import { createServer } from "node:http";
import {
  readFile,
  readdir,
  realpath,
  stat,
  mkdir,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import puppeteer from "puppeteer";

const { values } = parseArgs({
  options: {
    model: { type: "string" },
    app: { type: "string" },
    concurrency: { type: "string", default: "2" },
    timeout: { type: "string", default: "30000" },
    help: { type: "boolean" },
  },
});
if (values.help) {
  console.log(`Capture actual generated apps as desktop JPEG previews.

node scripts/capture-app-previews.mjs --model gpt-6-astra [--app asteroid-game]
  --model <id>       Required directory in public/apps
  --app <id>         Capture only this app; otherwise capture every app in the model
  --concurrency <n>  Concurrent pages, 1–4 (default: 2)
  --timeout <ms>     Deadline per app, 1000–120000 (default: 30000)

Renders at 1440×1000; waits 1.5 seconds after DOM readiness before capture.
Writes public/previews/<model>/<app>.jpg, replacing successful captures only.
Starts its own temporary loopback server on a random port; no dev server needed.
Requires the repository's Puppeteer dependency and its installed Chrome browser.`);
  process.exit(0);
}

const validId = (id) =>
  typeof id === "string" && /^[a-z0-9][a-z0-9.-]*$/.test(id);
const concurrency = Number(values.concurrency);
const timeout = Number(values.timeout);
if (
  !validId(values.model) ||
  (values.app !== undefined && !validId(values.app))
) {
  throw new Error(
    "Provide --model <id> and an optional --app <id> using letters, numbers, dots, and hyphens.",
  );
}
if (
  !Number.isInteger(concurrency) ||
  concurrency < 1 ||
  concurrency > 4 ||
  !Number.isInteger(timeout) ||
  timeout < 1000 ||
  timeout > 120000
) {
  throw new Error(
    "Concurrency must be 1–4 and timeout must be 1000–120000 milliseconds.",
  );
}
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public",
);
const publicRoot = await realpath(root);
function contained(base, target) {
  const relative = path.relative(base, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
async function withinPublic(target) {
  const resolved = await realpath(target);
  if (!contained(publicRoot, resolved))
    throw new Error("Path is outside public assets");
  return resolved;
}
const modelRoot = await withinPublic(path.join(root, "apps", values.model));
const entries = await readdir(modelRoot, { withFileTypes: true });
const apps = entries
  .filter(
    (entry) =>
      entry.isDirectory() &&
      validId(entry.name) &&
      (values.app === undefined || values.app === entry.name),
  )
  .map((entry) => entry.name)
  .sort();
if (!apps.length) throw new Error("No matching app directories found.");
const outputRoot = path.join(root, "previews", values.model);
await mkdir(outputRoot, { recursive: true });
await withinPublic(outputRoot);

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".wasm": "application/wasm",
};
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    let filename = await withinPublic(path.resolve(publicRoot, `.${pathname}`));
    if ((await stat(filename)).isDirectory())
      filename = await withinPublic(path.join(filename, "index.html"));
    const body =
      request.method === "HEAD" ? undefined : await readFile(filename);
    response.writeHead(200, {
      "Content-Type":
        mime[path.extname(filename)] ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
let browser;
let interrupted = false;
const stop = () => {
  interrupted = true;
  process.exitCode = 130;
  void browser?.close().catch(() => {});
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: timeout,
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  let next = 0;
  let completed = 0;
  let failed = 0;
  async function worker() {
    while (!interrupted && next < apps.length) {
      const app = apps[next++];
      let page;
      let deadline;
      const temporary = path.join(outputRoot, `.${app}.${process.pid}.jpg`);
      try {
        page = await browser.newPage();
        deadline = setTimeout(() => {
          void page.close().catch(() => {});
        }, timeout);
        await page.setViewport({
          width: 1440,
          height: 1000,
          deviceScaleFactor: 1,
        });
        const response = await page.goto(
          `${origin}/apps/${values.model}/${app}/index.html`,
          {
            waitUntil: "domcontentloaded",
            timeout,
          },
        );
        if (!response?.ok())
          throw new Error(`App returned HTTP ${response?.status()}`);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await page.screenshot({ path: temporary, type: "jpeg", quality: 72 });
        await rename(temporary, path.join(outputRoot, `${app}.jpg`));
        completed++;
        console.log(
          `[${completed + failed}/${apps.length}] ${values.model}/${app} captured`,
        );
      } catch (error) {
        failed++;
        console.error(
          `[${completed + failed}/${apps.length}] ${app}: ${error.message}`,
        );
      } finally {
        clearTimeout(deadline);
        await page?.close().catch(() => {});
        await rm(temporary, { force: true });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(
    `${completed} captured, ${failed} failed. Previews: ${outputRoot}`,
  );
  if (failed && !interrupted) process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
