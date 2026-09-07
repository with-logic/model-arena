import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("..", import.meta.url));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "arena-generate-test-"));
  for (const file of ["scripts/generate.ts", "scripts/codex-runtime.ts", "scripts/codex-cost.ts", "lib/harness-command.ts", "lib/models.config.ts"]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(source, file), path.join(root, file));
  }
  fs.mkdirSync(path.join(root, "examples"));
  for (const id of ["one", "two", "three"]) {
    fs.writeFileSync(path.join(root, "examples", `${id}.yaml`), `id: ${id}\ntitle: ${id}\nprompt: Build a clock\n`);
  }
  fs.mkdirSync(path.join(root, "node_modules"));
  fs.symlinkSync(path.join(source, "node_modules/yaml"), path.join(root, "node_modules/yaml"));
  const npm = path.join(root, "npm.cjs");
  const launcher = `
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
if (process.argv.includes('--version')) {
  console.log('codex-cli ' + (process.env.TEST_BAD_VERSION ? '0.0.1' : '0.0.0'));
  process.exit(0);
}
const id = crypto.randomUUID();
const dir = path.join(process.env.CODEX_HOME, 'sessions', '2026', '09', '07');
fs.mkdirSync(dir, {recursive:true});
fs.writeFileSync(path.join(dir, 'rollout-' + id + '.jsonl'), JSON.stringify({type:'event_msg', payload:{type:'token_count',info:{
  total_token_usage:{input_tokens:100000,cached_input_tokens:50000,cache_write_input_tokens:0,output_tokens:1000},
  last_token_usage:{input_tokens:100000}
}}}) + '\\n');
fs.appendFileSync(process.env.TEST_STARTED, process.pid + '\\n');
console.log(JSON.stringify({type:'thread.started',thread_id:id}));
if (process.env.TEST_HANG) {
  process.on('SIGTERM', () => { fs.appendFileSync(process.env.TEST_STOPPED, process.pid + '\\n'); process.exit(0); });
  setInterval(() => {}, 1000);
} else {
  fs.writeFileSync('output/index.html', '<html><body>clock</body></html>');
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:100000,cached_input_tokens:50000,output_tokens:1000}}));
}
`;
  fs.writeFileSync(npm, `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'view') { console.log(JSON.stringify('0.0.0')); }
else {
  const prefix = args[args.indexOf('--prefix') + 1];
  const file = path.join(prefix, 'node_modules/@openai/codex/bin/codex.js');
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, ${JSON.stringify(launcher)});
}
`);
  return { root, npm };
}

function start(f, env = {}, args = []) {
  const child = spawn(process.execPath, [...process.execArgv, "scripts/generate.ts", "gpt-6-astra", ...args], {
    cwd: f.root,
    env: { ...process.env, npm_execpath: f.npm, CODEX_HOME: path.join(f.root, "codex-home"), TEST_STARTED: path.join(f.root, "started"), TEST_STOPPED: path.join(f.root, "stopped"), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, output }));
  });
  return { child, done, output: () => output };
}

test("generator uses a verified launcher, records live/final cost and generates outputs", async () => {
  const f = fixture();
  try {
    const result = await start(f).done;
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /Verified latest stable: codex-cli 0.0.0/);
    assert.match(result.output, /Final: Astra API-equivalent estimate \$1.8000/);
    assert.match(result.output, /Reasoning\/variant: xhigh/);
    const files = fs.readdirSync(path.join(f.root, "logs"));
    const log = fs.readFileSync(path.join(f.root, "logs", files[0]), "utf8");
    assert.match(log, /app so far: \$0.6000/);
    assert.match(log, /Final:.*\$1.8000/);
    assert.ok(fs.existsSync(path.join(f.root, "public/apps/gpt-6-astra/one/index.html")));
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("a version mismatch fails before any model starts", async () => {
  const f = fixture();
  try {
    const result = await start(f, { TEST_BAD_VERSION: "1" }).done;
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /Codex version mismatch/);
    assert.equal(fs.existsSync(path.join(f.root, "started")), false);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test("SIGINT stops concurrent generators, leaves queued tasks unstarted, and writes a partial cost total", async () => {
  const f = fixture();
  const run = start(f, { TEST_HANG: "1" }, ["--concurrency", "2"]);
  try {
    const deadline = Date.now() + 10_000;
    while (!run.output().includes("estimate $1.2000") && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.match(run.output(), /estimate \$1.2000/);
    run.child.kill("SIGINT");
    const result = await run.done;
    assert.equal(result.code, 130, result.output);
    assert.match(result.output, /Final \(interrupted; partial\):.*\$1.2000/);
    assert.equal(fs.readFileSync(path.join(f.root, "started"), "utf8").trim().split("\n").length, 2);
    assert.equal(fs.readFileSync(path.join(f.root, "stopped"), "utf8").trim().split("\n").length, 2);
    assert.equal(fs.existsSync(path.join(f.root, "public")), false);
  } finally {
    if (run.child.exitCode === null) { run.child.kill("SIGTERM"); await run.done; }
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});
