import assert from "node:assert/strict";
import { test } from "node:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CodexCostTracker, CodexUsageMonitor, JsonLines } from "../scripts/codex-cost.ts";

function event(input, cached, writes, output, lastInput = input) {
  return { type: "event_msg", payload: { type: "token_count", info: {
    total_token_usage: { input_tokens: input, cached_input_tokens: cached, cache_write_input_tokens: writes, output_tokens: output },
    last_token_usage: { input_tokens: lastInput },
  } } };
}

test("prices cached reads, cache writes and output without double counting duplicate reports", () => {
  const tracker = new CodexCostTracker();
  const report = event(100_000, 50_000, 10_000, 2_000);
  assert.equal(tracker.record(report), true);
  assert.equal(tracker.record(report), false);
  assert.equal(tracker.usd, 0.675);
  assert.equal(tracker.inputTokens, 100_000);
});

test("long-context pricing uses each request, not cumulative session input", () => {
  const tracker = new CodexCostTracker();
  tracker.record(event(200_000, 0, 0, 1_000));
  tracker.record(event(400_000, 0, 0, 2_000, 200_000));
  assert.equal(tracker.usd, 4.1);
  tracker.record(event(700_000, 0, 0, 3_000, 300_000));
  assert.equal(tracker.usd, 10.175);
});

test("final exec usage reconciles missing rollout data and labels it approximate", () => {
  const tracker = new CodexCostTracker();
  tracker.record(event(100_000, 0, 0, 1_000));
  tracker.finish({ input_tokens: 200_000, cached_input_tokens: 0, output_tokens: 2_000 });
  assert.equal(tracker.usd, 2.1);
  assert.equal(tracker.approximate, true);
  tracker.finish({ input_tokens: 200_000, cached_input_tokens: 0, output_tokens: 2_000 });
  assert.equal(tracker.usd, 2.1);
});

test("missing and malformed usage is never represented as measured zero cost", () => {
  const tracker = new CodexCostTracker();
  assert.equal(tracker.observed, false);
  assert.equal(tracker.record({ type: "event_msg", payload: { type: "token_count", info: null } }), false);
  assert.equal(tracker.record(event(-1, 0, 0, 1)), false);
  assert.equal(tracker.observed, false);
});

test("JSONL decoder handles chunk boundaries, unicode, invalid lines and final unterminated records", () => {
  const seen = [];
  const lines = new JsonLines((event) => seen.push(event));
  const bytes = Buffer.from('garbage\n{"text":"🌟"}\n{"done":true}');
  for (const byte of bytes) lines.push(Buffer.from([byte]));
  lines.end();
  assert.deepEqual(seen, [{ text: "🌟" }, { done: true }]);
});

test("tails only the matching thread, updates during a turn, and reconciles final usage once", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "arena-usage-test-"));
  const id = "0199a213-81c0-7800-8aa1-bbab2a035a53";
  const dir = path.join(root, "2026", "09", "07");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `rollout-date-${id}.jsonl`);
  fs.writeFileSync(path.join(dir, "unrelated.jsonl"), JSON.stringify(event(999999, 0, 0, 99999)) + "\n");
  const tracker = new CodexCostTracker();
  let updates = 0;
  const monitor = new CodexUsageMonitor(root, tracker, () => {}, () => updates++);
  try {
    monitor.push(Buffer.from(JSON.stringify({ type: "thread.started", thread_id: id }) + "\n"));
    const report = JSON.stringify(event(100_000, 50_000, 0, 1000));
    fs.writeFileSync(file, report.slice(0, 30));
    monitor.poll();
    assert.equal(tracker.observed, false);
    fs.appendFileSync(file, report.slice(30) + "\n");
    monitor.poll();
    assert.equal(tracker.usd, 0.6);
    assert.equal(updates, 1); // before turn.completed
    fs.appendFileSync(file, report + "\n");
    monitor.push(Buffer.from(JSON.stringify({ type: "turn.completed", usage: {
      input_tokens: 100_000, cached_input_tokens: 50_000, output_tokens: 1000,
    } }) + "\n"));
    monitor.finish();
    assert.equal(tracker.usd, 0.6);
    assert.equal(updates, 1);
    assert.equal(tracker.approximate, false);
  } finally {
    monitor.finish();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
