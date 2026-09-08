import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React, { act } from "react";

const dom = new JSDOM(
  '<!doctype html><html><body><div id="root"></div></body></html>',
  { url: "http://localhost/", pretendToBeVisual: true },
);
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Element",
  "Node",
  "NodeFilter",
  "CustomEvent",
  "MutationObserver",
  "Event",
  "MouseEvent",
  "getComputedStyle",
  "localStorage",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  });
}
globalThis.React = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
window.scrollTo = () => {};
HTMLElement.prototype.scrollIntoView = () => {};
let narrow = false;
const mediaListeners = new Set();
window.matchMedia = () => ({
  get matches() {
    return narrow;
  },
  addEventListener(_event, listener) {
    mediaListeners.add(listener);
  },
  removeEventListener(_event, listener) {
    mediaListeners.delete(listener);
  },
});
const { createRoot } = await import("react-dom/client");
const { Arena } = await import("../components/arena.tsx");
const { SELECTION_STORAGE_KEY } = await import("../lib/arena-state.ts");
const { DEFAULT_COMPARISON_MODELS } = await import("../lib/models.config.ts");
const apps = [
  {
    id: "ocean-wave-simulation",
    title: "Ocean Wave Simulation",
    prompt: "Goal: Simulate waves",
    tags: ["interactive"],
    poster: "/ocean.png",
    previews: {
      "gpt-6-astra": "/previews/gpt-6-astra/ocean-wave-simulation.jpg",
    },
    iframeUrl: "/",
  },
  {
    id: "new-app-without-stats",
    title: "Fresh Game",
    prompt: "Goal: Play a game",
    tags: ["game"],
    poster: "/game.png",
    previews: {
      "gpt-6-astra": "/previews/gpt-6-astra/new-app-without-stats.jpg",
    },
    iframeUrl: "/",
  },
];
let root;
beforeEach(() => {
  localStorage.clear();
  narrow = false;
  window.history.replaceState({}, "", "/");
  root = createRoot(document.getElementById("root"));
});
afterEach(async () => {
  await act(() => root.unmount());
});
async function render() {
  await act(() => root.render(React.createElement(Arena, { apps })));
}
function button(text) {
  const found = [...document.querySelectorAll("button")].find(
    (el) => el.textContent === text,
  );
  assert.ok(found, `button ${text}`);
  return found;
}
async function click(el) {
  assert.ok(el);
  await act(() => el.click());
}
async function option(text) {
  if (
    ![...document.querySelectorAll("button")].some(
      (el) => el.textContent === text,
    )
  ) {
    await click(document.querySelector('[aria-label="App options"]'));
  }
  await click(button(text));
}
async function chooseActiveModel(id) {
  await act(() => {
    const select = document.querySelector(".focused-model select");
    select.value = id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function input(el, value) {
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const activeFrames = () => [
  ...document.querySelectorAll(".app-card.active iframe"),
];
const activeApp = () => document.querySelector(".app-card.active")?.dataset.app;
const browse = () => document.querySelector(".index-button");
async function key(value, extra = {}) {
  await act(() =>
    window.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
        ...extra,
      }),
    ),
  );
}
async function history(direction) {
  await act(() => {
    window.history[direction]();
    return new Promise((resolve) => setTimeout(resolve, 40));
  });
}

test("fresh visitors land in a live Astra app with a searchable collection index", async () => {
  await render();
  assert.equal(activeFrames().length, 1);
  assert.equal(
    new URL(activeFrames()[0].src).pathname,
    "/apps/gpt-6-astra/ocean-wave-simulation/",
  );
  assert.equal(document.querySelectorAll(".thumb").length, apps.length);
  assert.equal(
    document
      .querySelector('.live-options a[target="_blank"]')
      .getAttribute("href"),
    "/apps/gpt-6-astra/ocean-wave-simulation/",
  );
  assert.equal(
    document.querySelector(".arena-live").classList.contains("expanded"),
    false,
  );
  await click(browse());
  await input(
    document.querySelector('input[aria-label="Search apps"]'),
    "fresh",
  );
  assert.equal(document.querySelectorAll(".index-app").length, 1);
  await click(document.querySelector(".index-app"));
  assert.equal(activeApp(), "new-app-without-stats");
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test("returning visitors open Astra instead of restoring their old Opus default", async () => {
  localStorage.setItem(
    SELECTION_STORAGE_KEY,
    JSON.stringify(["opus-5", "gpt-6-astra"]),
  );
  await render();
  assert.equal(activeFrames().length, 1);
  assert.match(activeFrames()[0].src, /gpt-6-astra\/ocean-wave-simulation/);
  assert.deepEqual(JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)), [
    ...DEFAULT_COMPARISON_MODELS,
  ]);
});

test("outer arrow keys browse and wrap while modifier shortcuts leave the collection alone", async () => {
  await render();
  await key("ArrowRight");
  assert.equal(activeApp(), "new-app-without-stats");
  await key("ArrowRight");
  assert.equal(activeApp(), "ocean-wave-simulation");
  await key("ArrowLeft");
  assert.equal(activeApp(), "new-app-without-stats");
  await key("ArrowRight", { metaKey: true });
  assert.equal(activeApp(), "new-app-without-stats");
});

test("iframe focus and open dialogs retain keyboard ownership", async () => {
  await render();
  await act(() => activeFrames()[0].focus());
  await key("ArrowRight");
  assert.equal(activeApp(), "ocean-wave-simulation");
  await click(browse());
  await input(
    document.querySelector('input[aria-label="Search apps"]'),
    "wave",
  );
  await key("ArrowRight");
  assert.equal(activeApp(), "ocean-wave-simulation");
  await click(document.querySelector('[aria-label="Close app browser"]'));
  await act(() => document.querySelector(".index-button").focus());
  await key("ArrowRight");
  assert.equal(activeApp(), "new-app-without-stats");
});

test("Expand and Return preserve the active iframe and native history restores expanded state", async () => {
  await render();
  const frame = activeFrames()[0];
  await click(document.querySelector('[aria-label="Fill screen"]'));
  assert.match(window.location.pathname, /^\/compare\//);
  assert.equal(activeFrames()[0], frame);
  await click(document.querySelector('[aria-label="Return to collection"]'));
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  assert.equal(window.location.pathname, "/");
  assert.equal(activeFrames()[0], frame);
  await history("forward");
  assert.match(window.location.pathname, /^\/compare\//);
  assert.equal(activeFrames()[0], frame);
});

test("repeated Return requests wait for the pending history traversal", async () => {
  await render();
  const frame = activeFrames()[0];
  await click(document.querySelector('[aria-label="Fill screen"]'));
  const returnButton = document.querySelector(
    '[aria-label="Return to collection"]',
  );
  await act(() => {
    returnButton.click();
    returnButton.click();
  });
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  assert.equal(window.location.pathname, "/");
  assert.equal(activeFrames()[0], frame);
  await history("forward");
  assert.match(window.location.pathname, /^\/compare\//);
});

test("compare uses the default three models and clicking a focused model again restores split view", async () => {
  await render();
  const frame = activeFrames()[0];
  assert.match(frame.src, /gpt-6-astra/);
  await click(document.querySelector('[aria-label="Compare side by side"]'));
  assert.deepEqual(
    activeFrames().map((frame) => new URL(frame.src).pathname),
    [
      "/apps/gpt-6-astra/ocean-wave-simulation/",
      "/apps/opus-5/ocean-wave-simulation/",
      "/apps/qwen-3.8-27b/ocean-wave-simulation/",
    ],
  );
  assert.equal(activeFrames()[0], frame);
  const tabs = () => document.querySelectorAll(".model-tabs button");
  await click(tabs()[0]);
  assert.equal(activeFrames().length, 1);
  assert.equal(activeFrames()[0], frame);
  await click(tabs()[0]);
  assert.equal(activeFrames().length, 3);
  await click(tabs()[0]);
  await click(tabs()[1]);
  assert.equal(activeFrames().length, 1);
  assert.match(activeFrames()[0].src, /opus-5/);
  await click(tabs()[1]);
  assert.equal(activeFrames().length, 3);
});

test("legacy comparison links retain model order and mobile displays the chosen model", async () => {
  narrow = true;
  window.history.replaceState(
    {},
    "",
    "/compare/new-app-without-stats?models=opus-5,gpt-6-astra&view=side-by-side",
  );
  await render();
  assert.equal(activeFrames().length, 1);
  assert.match(activeFrames()[0].src, /opus-5/);
  await chooseActiveModel("gpt-6-astra");
  assert.match(activeFrames()[0].src, /gpt-6-astra/);
  await act(() => {
    narrow = false;
    mediaListeners.forEach((listener) => listener());
  });
  assert.equal(activeFrames().length, 2);
  await click(document.querySelector('[aria-label="Return to collection"]'));
  assert.equal(window.location.pathname, "/");
  assert.deepEqual(JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)), [
    "opus-5",
    "gpt-6-astra",
  ]);
});

test("single model picker replaces the live model and keeps Astra thumbnail fallbacks", async () => {
  window.history.replaceState({}, "", "/?models=gpt-6-astra");
  await render();
  await click(document.querySelector('[aria-label^="Change model"]'));
  await input(document.querySelector(".arena-model-dialog input"), "opus 5");
  await click(
    [...document.querySelectorAll(".arena-model-option")].find((el) =>
      el.textContent.includes("Opus 5"),
    ),
  );
  assert.match(activeFrames()[0].src, /opus-5/);
  assert.ok(
    [...document.querySelectorAll(".thumb img")].every((img) =>
      img.src.includes("/previews/gpt-6-astra/"),
    ),
  );
  assert.match(document.querySelector(".thumb img").title, /Astra/);
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test("comparison picker searches all models and enforces the four-model limit", async () => {
  await render();
  await click(document.querySelector('[aria-label="Compare side by side"]'));
  await click(
    document.querySelector('[aria-label="Choose models, 3 selected"]'),
  );
  const search = document.querySelector(".arena-model-dialog input");
  await input(search, "astra");
  assert.equal(document.querySelectorAll(".arena-model-option").length, 1);
  await input(search, "");
  await click(
    document.querySelector(
      '.arena-model-option[aria-pressed="false"]:not(:disabled)',
    ),
  );
  assert.equal(
    document.querySelectorAll('.arena-model-option[aria-pressed="true"]')
      .length,
    4,
  );
  assert.ok(
    [
      ...document.querySelectorAll('.arena-model-option[aria-pressed="false"]'),
    ].every((el) => el.disabled),
  );
  await click(button("Done"));
  assert.equal(activeFrames().length, 4);
});

test("stats retains the shortlist and exposes searchable measurements for all models", async () => {
  await render();
  await click(
    document.querySelector('.collection-links a[href*="page=stats"]'),
  );
  assert.equal(document.querySelectorAll("tbody tr").length, 3);
  await click(
    [...document.querySelectorAll("button")].find((el) =>
      el.textContent.startsWith("All models ·"),
    ),
  );
  assert.ok(document.querySelectorAll("tbody tr").length > 20);
  await input(
    document.querySelector('input[placeholder="Search models…"]'),
    "astra",
  );
  assert.equal(document.querySelectorAll("tbody tr").length, 1);
  await click(document.querySelector('button[aria-label^="Sort by Average"]'));
  assert.ok(document.querySelector('th[aria-sort="ascending"]'));
  await click(document.querySelector('button[aria-label^="Explore apps by"]'));
  assert.ok(document.querySelector(".arena-live"));
  assert.match(activeFrames()[0].src, /gpt-6-astra/);
});

test("browser Back from expanded comparison keeps the current app and edited shortlist", async () => {
  await render();
  await click(document.querySelector('[aria-label="Fill screen"]'));
  await click(document.querySelector('[aria-label="Compare side by side"]'));
  await key("ArrowRight");
  const frame = activeFrames()[0],
    models = JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY));
  await history("back");
  assert.equal(window.location.pathname, "/");
  assert.equal(activeApp(), "new-app-without-stats");
  assert.equal(activeFrames()[0], frame);
  assert.deepEqual(
    JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)),
    models,
  );
  await history("forward");
  assert.match(window.location.pathname, /compare/);
  assert.equal(activeApp(), "new-app-without-stats");
});

test("clipboard completions cannot overwrite newer requests or navigation", async () => {
  const requests = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (url) =>
        new Promise((resolve, reject) =>
          requests.push({ url, resolve, reject }),
        ),
    },
  });
  await render();
  await option("Share");
  await click(document.querySelectorAll(".thumb")[1]);
  await act(async () => requests[0].resolve());
  assert.equal(document.querySelector(".arena-share").textContent, "Share");
  await option("Share");
  await option("Share");
  await act(async () => requests[2].resolve());
  assert.equal(
    document.querySelector(".arena-share").textContent,
    "Link copied",
  );
  await act(async () => requests[1].reject(new Error("Old failure")));
  assert.equal(
    document.querySelector(".arena-share").textContent,
    "Link copied",
  );
  await option("Code stats");
  assert.equal(document.querySelector(".arena-share").textContent, "Share");
  await option("Share");
  await act(async () => requests[3].reject(new Error("Denied")));
  assert.equal(
    document.querySelector('input[aria-label="Shareable comparison link"]')
      .value,
    window.location.href,
  );
});

test("model directory filters providers and edits the shared shortlist", async () => {
  await render();
  await click(
    document.querySelector('.collection-links a[href*="page=models"]'),
  );
  await act(() => {
    const select = document.querySelector(".arena-provider-filter select");
    select.value = "openai";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.ok(
    [...document.querySelectorAll(".arena-directory-name > span")].every(
      (el) => el.textContent === "OpenAI",
    ),
  );
  await input(
    document.querySelector('input[placeholder="Find a model or provider…"]'),
    "gpt-5.1",
  );
  assert.equal(document.querySelectorAll(".arena-directory-row").length, 1);
  await click(document.querySelector(".arena-add-model"));
  assert.deepEqual(JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)), [
    ...DEFAULT_COMPARISON_MODELS,
    "gpt-5.1",
  ]);
});

test("exploring a model from arena statistics returns to live apps", async () => {
  await render();
  await option("Code stats");
  await click(document.querySelector('.live-options a[href*="page=stats"]'));
  await click(
    document.querySelector('[aria-label="Explore apps by GPT-6 Astra"]'),
  );
  assert.ok(!document.querySelector(".live-app-stats"));
  assert.equal(activeFrames().length, 1);
  assert.match(activeFrames()[0].src, /gpt-6-astra/);
  assert.equal(
    new URLSearchParams(window.location.search).get("content") ?? "demo",
    "demo",
  );
});

test("direct app statistics present real measurements without starting apps", async () => {
  window.history.replaceState(
    {},
    "",
    "/compare/ocean-wave-simulation?models=gpt-6-astra,opus-5&content=stats",
  );
  await render();
  assert.equal(document.querySelectorAll("iframe").length, 0);
  const headers = [
    ...document.querySelectorAll(".live-app-stats thead th"),
  ].map((el) => el.textContent);
  assert.match(headers[1], /Astra/);
  assert.match(headers[2], /Opus 5/);
  assert.equal(
    document.querySelectorAll(".live-app-stats tbody tr").length,
    12,
  );
});

test("unknown app URLs provide an accessible route back to the collection", async () => {
  window.history.replaceState({}, "", "/compare/unknown-app");
  await render();
  const dialog = document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /isn’t in the collection/);
  assert.ok(dialog.contains(document.activeElement));
  await click(button("Explore all apps"));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(window.location.pathname, "/");
});

test("prompt and options preserve the running app and options dismiss on frame focus", async () => {
  await render();
  const frame = activeFrames()[0];
  await option("Shared prompt");
  assert.match(
    document.querySelector(".prompt-dialog").textContent,
    /Simulate waves/,
  );
  assert.equal(activeFrames()[0], frame);
  await click(document.querySelector('[aria-label="Close prompt"]'));
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "App options",
  );
  await click(document.querySelector(".prompt-button"));
  await click(document.querySelector('[aria-label="Close prompt"]'));
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
  assert.ok(document.activeElement.classList.contains("prompt-button"));
  await click(document.querySelector('[aria-label="App options"]'));
  assert.ok(document.querySelector(".live-options").open);
  await act(() => {
    frame.focus();
    window.dispatchEvent(new Event("blur"));
    return new Promise((resolve) => setTimeout(resolve, 25));
  });
  assert.equal(document.querySelector(".live-options").open, false);
  assert.equal(activeFrames()[0], frame);
});
