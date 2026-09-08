import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseArenaLocation,
  buildArenaUrl,
  normalizeModels,
  DEFAULT_LOCATION,
} from "../lib/arena-state.ts";
import { DEFAULT_COMPARISON_MODELS } from "../lib/models.config.ts";

test("shared links override remembered models and preserve order while removing duplicates", () => {
  const s = parseArenaLocation(
    "/compare/asteroid-game/",
    "?models=gpt-6-astra,opus-5,gpt-6-astra,unknown&view=tabs&tab=opus-5&content=stats",
    ["gpt-5"],
  );
  assert.deepEqual(s.models, ["gpt-6-astra", "opus-5"]);
  assert.equal(s.tab, "opus-5");
  assert.equal(s.content, "stats");
  assert.equal(s.appId, "asteroid-game");
});
test("invalid or oversized model selections remain usable", () => {
  assert.deepEqual(normalizeModels(["invalid"]), [
    ...DEFAULT_COMPARISON_MODELS,
  ]);
  assert.equal(
    normalizeModels([
      "gpt-5",
      "gpt-5.1",
      "gpt-5.2",
      "gpt-5.3-codex",
      "gpt-6-astra",
      "opus-5",
    ]).length,
    4,
  );
  const s = parseArenaLocation("/", "?models=opus-5&tab=gpt-6-astra");
  assert.equal(s.tab, "opus-5");
});
test("navigation round trips filters, shortlist and display state", () => {
  const s = {
    ...DEFAULT_LOCATION,
    page: "stats",
    q: "space & music",
    category: "game",
    models: ["gpt-6-astra", "opus-5"],
    tab: "opus-5",
    view: "tabs",
    content: "stats",
  };
  const u = new URL(buildArenaUrl(s), "http://localhost");
  assert.deepEqual(parseArenaLocation(u.pathname, u.search), s);
});
test("a bare URL resets view/content while remembering the shortlist", () => {
  const s = parseArenaLocation("/", "", ["gpt-6-astra"]);
  assert.equal(s.content, "demo");
  assert.equal(s.view, "tabs");
  assert.equal(s.page, "explore");
  assert.deepEqual(s.models, ["gpt-6-astra"]);
});
test("untrusted model values and malformed paths do not crash navigation", () => {
  assert.deepEqual(normalizeModels(null), [...DEFAULT_COMPARISON_MODELS]);
  assert.deepEqual(normalizeModels([42, {}, "opus-5"]), ["opus-5"]);
  assert.doesNotThrow(() => parseArenaLocation("/compare/%ZZ", "?page=bogus"));
});

test("fresh collection opens Astra solo and round-trips the selected app without expanding", () => {
  const initial = parseArenaLocation("/", "");
  assert.deepEqual(initial.models, ["gpt-6-astra"]);
  assert.equal(initial.view, "tabs");
  assert.equal(initial.expanded, false);
  const next = { ...initial, appId: "asteroid-game" };
  const url = new URL(buildArenaUrl(next), "http://localhost");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("app"), "asteroid-game");
  assert.deepEqual(parseArenaLocation(url.pathname, url.search), next);
});
test("existing comparison links stay expanded and split by default", () => {
  const state = parseArenaLocation(
    "/compare/asteroid-game",
    "?models=opus-5,gpt-6-astra",
  );
  assert.equal(state.expanded, true);
  assert.equal(state.view, "side-by-side");
  assert.match(buildArenaUrl(state), /^\/compare\/asteroid-game\?/);
});
