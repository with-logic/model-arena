import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const registry = "https://registry.npmjs.org";

/** Resolve once per arena run, then use the same verified release for every task. */
export async function prepareCodex(repoRoot: string): Promise<string> {
  const npmCli = realpathSync(process.env.npm_execpath || path.join(path.dirname(process.execPath), "npm"));
  const npm = async (args: string[]) => execute(process.execPath, [npmCli, ...args], {
    cwd: repoRoot, timeout: 180_000, maxBuffer: 4 * 1024 * 1024,
  });
  console.log("[codex] Checking npm for the latest stable release...");
  const { stdout } = await npm(["view", "@openai/codex@latest", "version", "--json", "--prefer-online", `--registry=${registry}`]);
  const version: unknown = JSON.parse(stdout);
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("npm did not return a stable Codex version; refusing a PATH fallback.");
  }
  const prefix = path.join(repoRoot, ".cache", "codex", version);
  const launcher = path.join(prefix, "node_modules", "@openai", "codex", "bin", "codex.js");
  if (!existsSync(launcher)) {
    console.log(`[codex] Installing @openai/codex@${version} in ${prefix}`);
    await npm(["install", "--prefix", prefix, "--no-save", "--package-lock=false", "--no-audit", "--no-fund", "--include=optional", `--registry=${registry}`, `@openai/codex@${version}`]);
  }
  const actualLauncher = realpathSync(launcher);
  const result = await execute(process.execPath, [actualLauncher, "--version"], { timeout: 15_000 });
  if (result.stdout.trim() !== `codex-cli ${version}`) {
    throw new Error(`Codex version mismatch: expected ${version}, received ${result.stdout.trim()}`);
  }
  console.log(`[codex] Verified latest stable: ${result.stdout.trim()}\n[codex] Launcher: ${actualLauncher}`);
  return actualLauncher;
}
