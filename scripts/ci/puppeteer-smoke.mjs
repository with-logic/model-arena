import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const source = fileURLToPath(new URL("../..", import.meta.url));

test("Puppeteer validates generated HTML and captures an app preview", { timeout: 90_000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "arena-browser-smoke-"));
  try {
    for (const file of [
      "scripts/generate.ts", "scripts/codex-runtime.ts", "scripts/codex-cost.ts",
      "scripts/capture-app-previews.mjs", "lib/harness-command.ts", "lib/models.config.ts",
    ]) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.copyFileSync(path.join(source, file), path.join(root, file));
    }
    fs.symlinkSync(path.join(source, "node_modules"), path.join(root, "node_modules"));
    fs.mkdirSync(path.join(root, "examples"));
    fs.writeFileSync(path.join(root, "examples/smoke.yaml"), "id: smoke\ntitle: Smoke\nprompt: Browser smoke fixture\n");
    const app = path.join(root, "public/apps/opus-4.1/smoke/index.html");
    fs.mkdirSync(path.dirname(app), { recursive: true });
    const validHtml = "<!doctype html><html><body><h1>Browser smoke</h1></body></html>";
    fs.writeFileSync(app, validHtml);

    // Invalid HTML may request regeneration; never invoke a real model in CI.
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "claude"), "#!/usr/bin/env node\nprocess.exit(19);\n", { mode: 0o755 });
    function run(args) {
      const result = spawnSync(process.execPath, [...process.execArgv, ...args], {
        cwd: root,
        env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
        encoding: "utf8",
        timeout: 45_000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      return result.stdout + result.stderr;
    }

    const valid = run(["scripts/generate.ts", "opus-4.1"]);
    assert.match(valid, /Skipped:\s+1/);
    assert.match(valid, /Failed:\s+0/);

    fs.writeFileSync(app, '<!doctype html><script>throw new Error("arena-browser-smoke-error")</script>');
    const invalid = run(["scripts/generate.ts", "opus-4.1"]);
    assert.match(invalid, /Page error: arena-browser-smoke-error/);
    assert.match(invalid, /Failed:\s+1/);

    fs.writeFileSync(app, validHtml);
    const captured = run(["scripts/capture-app-previews.mjs", "--model", "opus-4.1", "--app", "smoke", "--concurrency", "1", "--timeout", "10000"]);
    assert.match(captured, /1 captured, 0 failed/);
    const preview = fs.readFileSync(path.join(root, "public/previews/opus-4.1/smoke.jpg"));
    assert.deepEqual([...preview.subarray(0, 3)], [0xff, 0xd8, 0xff]);
    assert.ok(preview.length > 1000);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
