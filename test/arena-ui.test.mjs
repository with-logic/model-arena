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
const { AppGridWithRouting } =
  await import("../components/app-grid-with-routing.tsx");
const { SELECTION_STORAGE_KEY } = await import("../lib/arena-state.ts");
const apps = [
  {
    id: "ocean-wave-simulation",
    title: "Ocean Wave Simulation",
    prompt: "Goal: Simulate waves",
    tags: ["interactive"],
    poster: "/ocean.png",
    iframeUrl: "/",
  },
  {
    id: "new-app-without-stats",
    title: "Fresh Game",
    prompt: "Goal: Play a game",
    tags: ["game"],
    poster: "/game.png",
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
  await act(() =>
    root.render(React.createElement(AppGridWithRouting, { apps })),
  );
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
    await click(document.querySelector('[aria-label="Comparison options"]'));
  }
  await click(button(text));
}
async function chooseActiveModel(id) {
  await act(() => {
    const select = document.querySelector(".arena-focused-model select");
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

test("gallery filters, comparison close, and reopening retain the chosen models", async () => {
  await render();
  await input(
    document.querySelector('input[placeholder^="Search apps"]'),
    "waves",
  );
  assert.equal(document.querySelectorAll(".arena-app-card").length, 1);
  await click(document.querySelector(".arena-app-card"));
  assert.equal(document.querySelectorAll("iframe").length, 3);
  await click(button("Models3"));
  await click(
    document.querySelector('.arena-model-dialog [aria-label^="Remove Qwen"]'),
  );
  await click(button("Done"));
  assert.equal(document.querySelectorAll("iframe").length, 2);
  await click(button("Collection"));
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.querySelectorAll(".arena-app-card").length, 1);
  assert.equal(
    JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)).length,
    2,
  );
  await click(document.querySelector(".arena-app-card"));
  assert.equal(document.querySelectorAll("iframe").length, 2);
});

test("direct mobile links focus one app, support switching models, and close inside Arena", async () => {
  narrow = true;
  window.history.replaceState(
    {},
    "",
    "/compare/new-app-without-stats?models=opus-5,gpt-6-astra&view=side-by-side",
  );
  await render();
  assert.equal(
    document
      .querySelector(".arena-bar-picker button")
      .getAttribute("aria-label"),
    "Choose models, 2 selected",
  );
  assert.equal(document.querySelectorAll("iframe").length, 1);
  assert.match(
    document.querySelector("iframe").src,
    /opus-5\/new-app-without-stats/,
  );
  await chooseActiveModel("gpt-6-astra");
  assert.match(
    document.querySelector("iframe").src,
    /gpt-6-astra\/new-app-without-stats/,
  );
  await option("Code stats");
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /Measurements are not available/,
  );
  await click(button("Collection"));
  assert.equal(window.location.pathname, "/");
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test("picker searches all models, caps comparisons, and preserves a nonempty selection", async () => {
  await render();
  await click(button("Choose models3"));
  const search = document.querySelector(".arena-model-dialog input");
  await input(search, "astra");
  const choices = [...document.querySelectorAll(".arena-model-option")];
  assert.equal(choices.length, 1);
  assert.match(choices[0].textContent, /Astra/);
  await input(search, "");
  const unselected = [...document.querySelectorAll(".arena-model-option")].find(
    (el) => el.getAttribute("aria-pressed") === "false",
  );
  await click(unselected);
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
  for (let i = 0; i < 3; i++)
    await click(
      document.querySelector(
        '.arena-model-dialog [aria-label^="Remove "]:not(:disabled)',
      ),
    );
  assert.equal(
    document.querySelectorAll('.arena-model-option[aria-pressed="true"]')
      .length,
    1,
  );
  assert.ok(
    document.querySelector('.arena-model-option[aria-pressed="true"]').disabled,
  );
});

test("stats keeps the shortlist while exposing searchable measurements for all models", async () => {
  await render();
  await click(document.querySelector('.arena-nav a[href*="page=stats"]'));
  assert.equal(document.querySelectorAll("tbody tr").length, 3);
  await click(
    [...document.querySelectorAll("button")].find((el) =>
      el.textContent.startsWith("All models ·"),
    ),
  );
  assert.ok(document.querySelectorAll("tbody tr").length > 20);
  const selected = JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY));
  assert.equal(selected.length, 3);
  await input(
    document.querySelector('input[placeholder="Search models…"]'),
    "astra",
  );
  assert.equal(document.querySelectorAll("tbody tr").length, 1);
  assert.match(document.querySelector("tbody").textContent, /Astra/);
  await click(document.querySelector('button[aria-label^="Sort by Average"]'));
  assert.equal(
    document
      .querySelector('th[aria-sort="ascending"] button')
      .textContent.startsWith("Average"),
    true,
  );
  await click(document.querySelector('button[aria-label^="Explore apps by"]'));
  assert.equal(
    document.querySelector('.arena-nav [aria-current="page"]').textContent,
    "Explore apps",
  );
  assert.deepEqual(JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)), [
    "gpt-6-astra",
  ]);
});

test("browser Back keeps shortlist edits and forward honors the comparison URL", async () => {
  await render();
  await click(document.querySelector(".arena-app-card"));
  await click(button("Models3"));
  await click(
    document.querySelector('.arena-model-dialog [aria-label^="Remove Qwen"]'),
  );
  await click(button("Done"));
  const models = JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY));
  await act(() => {
    window.history.back();
    return new Promise((resolve) => setTimeout(resolve, 40));
  });
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.deepEqual(
    JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)),
    models,
  );
  assert.equal(
    new URLSearchParams(window.location.search).get("models"),
    models.join(","),
  );
  assert.equal(document.activeElement.className, "arena-app-card");
  await act(() => {
    window.history.forward();
    return new Promise((resolve) => setTimeout(resolve, 40));
  });
  assert.equal(document.querySelectorAll("iframe").length, 2);
  assert.equal(window.location.pathname, "/compare/ocean-wave-simulation");
});

test("viewport changes switch between split and focused apps without losing selection", async () => {
  await render();
  await click(document.querySelector(".arena-app-card"));
  assert.equal(document.querySelectorAll("iframe").length, 3);
  await act(() => {
    narrow = true;
    mediaListeners.forEach((listener) => listener());
  });
  assert.equal(document.querySelectorAll("iframe").length, 1);
  assert.equal(
    document.querySelector(".arena-back").getAttribute("aria-label"),
    "Back to collection",
  );
  await chooseActiveModel("gpt-6-astra");
  assert.match(document.querySelector("iframe").src, /gpt-6-astra/);
  await act(() => {
    narrow = false;
    mediaListeners.forEach((listener) => listener());
  });
  assert.equal(document.querySelectorAll("iframe").length, 3);
  await click(button("Collection"));
  await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
  assert.equal(mediaListeners.size, 0);
});

test("clipboard responses cannot overwrite status after navigation or newer requests", async () => {
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
  await click(document.querySelector(".arena-app-card"));
  await option("Share");
  await act(() => {
    const select = document.querySelector(".arena-app-navigation select");
    select.value = "new-app-without-stats";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    requests[0].resolve();
  });
  assert.equal(document.querySelector(".arena-share").textContent, "Share");
  await option("Share");
  await option("Share");
  await act(async () => {
    requests[2].resolve();
  });
  assert.equal(
    document.querySelector(".arena-share").textContent,
    "Link copied",
  );
  await act(async () => {
    requests[1].reject(new Error("Older request failed"));
  });
  assert.equal(
    document.querySelector(".arena-share").textContent,
    "Link copied",
  );
  await option("Code stats");
  assert.equal(document.querySelector(".arena-share").textContent, "Share");
  await option("Share");
  await act(async () => {
    requests[3].reject(new Error("Clipboard denied"));
  });
  assert.equal(
    document.querySelector('input[aria-label="Shareable comparison link"]')
      .value,
    window.location.href,
  );
});

test("model directory filters providers and edits the shared comparison", async () => {
  await render();
  await click(document.querySelector('.arena-nav a[href*="page=models"]'));
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
    "astra",
  );
  assert.equal(document.querySelectorAll(".arena-directory-row").length, 1);
  await click(document.querySelector(".arena-add-model"));
  assert.equal(
    JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)).includes(
      "gpt-6-astra",
    ),
    false,
  );
});

test("populated app statistics show selected models in order with actual measurements", async () => {
  window.history.replaceState(
    {},
    "",
    "/compare/ocean-wave-simulation?models=gpt-6-astra,opus-5&content=stats",
  );
  await render();
  assert.equal(document.querySelectorAll("iframe").length, 0);
  const headers = [
    ...document.querySelectorAll('[role="dialog"] thead th'),
  ].map((el) => el.textContent);
  assert.match(headers[1], /Astra/);
  assert.match(headers[2], /Opus 5/);
  assert.equal(
    document.querySelectorAll('[role="dialog"] tbody tr').length,
    12,
  );
  assert.doesNotMatch(
    document.querySelector('[role="dialog"] tbody').textContent,
    /Unavailable/,
  );
});

test("unknown app links provide a focused, keyboard-accessible way back to the collection", async () => {
  window.history.replaceState({}, "", "/compare/unknown-app");
  await render();
  const dialog = document.querySelector('[role="dialog"]');
  assert.match(dialog.textContent, /isn’t in the collection/);
  assert.ok(dialog.contains(document.activeElement));
  await click(button("Explore all apps"));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(window.location.pathname, "/");
});

test("comparison options and prompt do not add rows or remount the running app", async () => {
  await render();
  await click(document.querySelector(".arena-app-card"));
  const frame = document.querySelector("iframe");
  assert.equal(document.querySelectorAll(".arena-comparison-bar").length, 1);
  assert.equal(document.querySelector(".arena-workspace-toolbar"), null);
  await option("Shared prompt");
  const prompt = document.querySelector(".arena-prompt-dialog");
  assert.match(prompt.textContent, /Goal: Simulate waves/);
  assert.equal(document.querySelector("iframe"), frame);
  await click(document.querySelector('[aria-label="Close prompt"]'));
  await act(() => new Promise((resolve) => setTimeout(resolve, 5)));
  assert.equal(
    document.activeElement.getAttribute("aria-label"),
    "Comparison options",
  );
  await click(document.querySelector('[aria-label="Comparison options"]'));
  await act(() =>
    document.activeElement.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(document.querySelector(".arena-comparison-options"), null);
  assert.ok(document.querySelector(".arena-workspace"));
  assert.equal(document.querySelector("iframe"), frame);
});

test("comparison options dismiss when focus enters a running app", async () => {
  await render();
  await click(document.querySelector(".arena-app-card"));
  await click(document.querySelector('[aria-label="Comparison options"]'));
  assert.ok(document.querySelector(".arena-comparison-options"));
  await act(() => {
    document.querySelector("iframe").focus();
    window.dispatchEvent(new Event("blur"));
    return new Promise((resolve) => setTimeout(resolve, 25));
  });
  assert.equal(document.querySelector(".arena-comparison-options"), null);
  assert.ok(document.querySelector("iframe"));
});

test("clicking the focused model again restores split view while other tabs switch solo models", async () => {
  await render();
  await click(document.querySelector(".arena-app-card"));
  const tabs = () =>
    document.querySelectorAll(".arena-workspace-models button");
  await click(tabs()[1]);
  assert.equal(document.querySelectorAll("iframe").length, 1);
  assert.match(document.querySelector("iframe").src, /gpt-6-astra/);
  await click(tabs()[1]);
  assert.equal(document.querySelectorAll("iframe").length, 3);
  assert.equal(
    new URLSearchParams(window.location.search).get("view"),
    "side-by-side",
  );
  await click(tabs()[0]);
  await click(tabs()[1]);
  assert.equal(document.querySelectorAll("iframe").length, 1);
  assert.match(document.querySelector("iframe").src, /gpt-6-astra/);
  await click(tabs()[1]);
  assert.equal(document.querySelectorAll("iframe").length, 3);
});
