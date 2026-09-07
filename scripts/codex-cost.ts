import * as fs from "node:fs";
import * as path from "node:path";
import { StringDecoder } from "node:string_decoder";

type Usage = { input_tokens: number; cached_input_tokens: number; cache_write_input_tokens: number; output_tokens: number };
const zero = (): Usage => ({ input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0 });

function usage(value: unknown): Usage | undefined {
  if (!value || typeof value !== "object") return;
  const raw = value as Record<string, unknown>;
  const result = {
    input_tokens: raw.input_tokens,
    cached_input_tokens: raw.cached_input_tokens ?? 0,
    cache_write_input_tokens: raw.cache_write_input_tokens ?? 0,
    output_tokens: raw.output_tokens,
  };
  if (!Object.values(result).every((n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0)) return;
  const valid = result as Usage;
  if (valid.cached_input_tokens + valid.cache_write_input_tokens > valid.input_tokens) return;
  return valid;
}

/** Standard API-equivalent Astra estimates, verified 2026-09-07:
 * https://developers.openai.com/api/docs/models/gpt-6-astra
 * Output already includes reasoning tokens. Do not charge those twice.
 */
export class CodexCostTracker {
  private total = zero();
  usd = 0;
  observed = false;
  approximate = false;
  get inputTokens() { return this.total.input_tokens; }
  get outputTokens() { return this.total.output_tokens; }

  record(event: unknown): boolean {
    const record = event as { type?: string; payload?: { type?: string; info?: { total_token_usage?: unknown; last_token_usage?: { input_tokens?: number } } } };
    if (record?.type !== "event_msg" || record.payload?.type !== "token_count") return false;
    const info = record.payload.info;
    const total = usage(info?.total_token_usage);
    if (!total) return false;
    const input = info?.last_token_usage?.input_tokens;
    const knownContext = typeof input === "number" && Number.isSafeInteger(input) && input >= 0;
    return this.update(total, knownContext ? input : 0, !knownContext);
  }

  finish(raw: unknown): boolean {
    const total = usage(raw);
    if (!total) return false;
    // exec's final usage lacks request boundaries. Use standard rates for any
    // unobserved remainder and label the estimate approximate.
    return this.update(total, 0, true);
  }

  private update(total: Usage, requestInput: number, approximate: boolean): boolean {
    const delta = zero();
    for (const key of Object.keys(delta) as (keyof Usage)[]) {
      delta[key] = total[key] - this.total[key];
      if (delta[key] < 0) return false; // stale or reset report
    }
    if (this.observed && Object.values(delta).every((n) => n === 0)) return false;
    if (delta.cached_input_tokens + delta.cache_write_input_tokens > delta.input_tokens) return false;
    const long = requestInput > 272_000;
    const uncached = delta.input_tokens - delta.cached_input_tokens - delta.cache_write_input_tokens;
    this.usd += ((uncached * 10 + delta.cached_input_tokens + delta.cache_write_input_tokens * 12.5) * (long ? 2 : 1)
      + delta.output_tokens * 50 * (long ? 1.5 : 1)) / 1_000_000;
    this.total = total;
    this.observed = true;
    this.approximate ||= approximate;
    return true;
  }
}

/** Incremental JSONL decoding handles partial writes and split UTF-8 characters. */
export class JsonLines {
  private pending = "";
  private decoder = new StringDecoder("utf8");
  constructor(private onEvent: (event: unknown) => void) {}
  push(chunk: Buffer) {
    this.pending += this.decoder.write(chunk);
    let newline: number;
    while ((newline = this.pending.indexOf("\n")) !== -1) {
      const line = this.pending.slice(0, newline);
      this.pending = this.pending.slice(newline + 1);
      this.parse(line);
    }
  }
  end() {
    this.pending += this.decoder.end();
    if (this.pending.trim()) this.parse(this.pending);
    this.pending = "";
  }
  private parse(line: string) {
    let event: unknown;
    try { event = JSON.parse(line); } catch { return; }
    this.onEvent(event);
  }
}

/** exec only emits aggregate usage at turn completion. Tail its own persisted
 * rollout for per-request token_count events while the turn is still running.
 */
export class CodexUsageMonitor {
  private threadId?: string;
  private rollout?: string;
  private offset = 0;
  private finalUsage?: unknown;
  private timer?: ReturnType<typeof setInterval>;
  private rolloutLines: JsonLines;
  private events: JsonLines;
  private warned = false;

  constructor(
    private sessionsRoot: string,
    readonly tracker: CodexCostTracker | undefined,
    private log: (message: string) => void,
    private onUsage: () => void,
  ) {
    this.rolloutLines = new JsonLines((event) => {
      if (tracker?.record(event)) onUsage();
    });
    this.events = new JsonLines((value) => {
      const event = value as { type?: string; thread_id?: string; usage?: unknown; message?: string; error?: { message?: string }; item?: { type?: string; text?: string; command?: string } };
      if (event?.type === "thread.started" && /^[a-f0-9-]{36}$/.test(event.thread_id || "")) {
        this.threadId = event.thread_id;
        this.poll();
      }
      if (event?.type === "turn.completed") this.finalUsage = event.usage;
      if (event?.type === "item.completed" && event.item?.text) log(event.item.text);
      if (event?.type === "item.started" && event.item?.command) log(event.item.command);
      if (event?.type === "error" || event?.type === "turn.failed") log(event.message || event.error?.message || "Codex turn failed");
    });
    if (tracker) {
      this.timer = setInterval(() => this.poll(), 2000);
      this.timer.unref();
    }
  }

  push(chunk: Buffer) { this.events.push(chunk); }

  poll() {
    try {
      if (!this.tracker || !this.threadId) return;
      this.rollout ||= this.findRollout(this.sessionsRoot);
      if (!this.rollout) return;
      const file = fs.openSync(this.rollout, "r");
      try {
        const size = fs.fstatSync(file).size;
        const buffer = Buffer.alloc(Math.min(64 * 1024, size - this.offset));
        while (this.offset < size) {
          const read = fs.readSync(file, buffer, 0, Math.min(buffer.length, size - this.offset), this.offset);
          if (!read) break;
          this.offset += read;
          this.rolloutLines.push(buffer.subarray(0, read));
        }
      } finally { fs.closeSync(file); }
    } catch (error) {
      if (!this.warned) {
        this.warned = true;
        this.log(`Live usage unavailable: ${error}`);
      }
    }
  }

  finish() {
    clearInterval(this.timer);
    this.events.end();
    this.poll();
    this.rolloutLines.end();
    if (this.tracker?.finish(this.finalUsage)) this.onUsage();
  }

  private findRollout(directory: string): string | undefined {
    if (!fs.existsSync(directory)) return;
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(`-${this.threadId}.jsonl`)) return path.join(directory, entry.name);
    }
    for (const entry of entries.reverse()) {
      if (entry.isDirectory()) {
        const found = this.findRollout(path.join(directory, entry.name));
        if (found) return found;
      }
    }
  }
}
