import { execSync, spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "yaml";
import {
  models,
  getAppOutputPath,
  type ModelConfig,
} from "../lib/models.config";
import {
  buildHarnessCommand,
  buildHarnessSpawnEnv,
  type EnvOverrides,
} from "../lib/harness-command";
import { prepareCodex } from "./codex-runtime";
import { CodexCostTracker, CodexUsageMonitor } from "./codex-cost";

// Set Claude max output tokens globally to avoid truncation errors
process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = "128000";

// Check token limit configurations on startup
function checkTokenLimits(): void {
  const warnings: string[] = [];

  // Check Claude
  const claudeTokens = process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
  if (!claudeTokens || parseInt(claudeTokens, 10) < 64000) {
    warnings.push(
      `  - Claude: CLAUDE_CODE_MAX_OUTPUT_TOKENS=${claudeTokens || "unset"} (recommend 128000)`
    );
  }

  // Check Gemini settings file
  const geminiSettingsPath = path.join(os.homedir(), ".gemini", "settings.json");
  try {
    if (fs.existsSync(geminiSettingsPath)) {
      const settings = JSON.parse(fs.readFileSync(geminiSettingsPath, "utf-8"));
      if (!settings.maxOutputTokens || settings.maxOutputTokens < 32000) {
        warnings.push(
          `  - Gemini: maxOutputTokens=${settings.maxOutputTokens || "unset"} in ~/.gemini/settings.json (recommend 65536)`
        );
      }
    } else {
      warnings.push(
        `  - Gemini: ~/.gemini/settings.json not found (consider setting maxOutputTokens: 65536)`
      );
    }
  } catch {
    warnings.push(`  - Gemini: Could not read ~/.gemini/settings.json`);
  }

  if (warnings.length > 0) {
    console.log("\n\x1b[33m⚠️  Token limit warnings:\x1b[0m");
    warnings.forEach((w) => console.log(w));
    console.log();
  }
}

// ============================================================================
// Types
// ============================================================================

interface ExampleSpec {
  id: string;
  title: string;
  prompt: string;
  tags?: string[];
}

interface GenerateOptions {
  force: string[]; // App IDs to force regenerate
  forceAll: boolean; // Force regenerate all apps
  modelFilter: string[]; // Model IDs to generate for (empty = all)
  concurrency: number; // Number of parallel generations
  interactive: boolean; // Run a supported harness in its interactive terminal UI
}

interface SandboxRunOptions {
  interactive: boolean;
  maxRetries?: number;
}

// ============================================================================
// Configuration
// ============================================================================

const REPO_ROOT = path.resolve(__dirname, "..");
const EXAMPLES_DIR = path.join(REPO_ROOT, "examples");
let codexLauncher: string | undefined;
let stopping = false;
const activeChildren = new Set<ChildProcess>();
const costAttempts: Array<{ label: string; tracker: CodexCostTracker; finished: boolean }> = [];
let costLogPath: string | undefined;

function costLog(message: string): void {
  const line = `[cost ${new Date().toISOString()}] ${message}`;
  console.log(line);
  if (costLogPath) fs.appendFileSync(costLogPath, `${line}\n`);
}

function reportCost(label: string): void {
  if (!costLogPath) return;
  const observed = costAttempts.filter((attempt) => attempt.tracker.observed);
  const total = observed.reduce((sum, attempt) => sum + attempt.tracker.usd, 0);
  const missing = costAttempts.length - observed.length;
  const active = costAttempts.filter((attempt) => !attempt.finished).length;
  costLog(`${label}: Astra API-equivalent estimate $${total.toFixed(4)} USD; ` +
    `${observed.reduce((sum, a) => sum + a.tracker.inputTokens, 0).toLocaleString()} input / ` +
    `${observed.reduce((sum, a) => sum + a.tracker.outputTokens, 0).toLocaleString()} output tokens; ` +
    `${active} active, ${missing} attempt(s) with usage unavailable. ` +
    "Observed usage only; in-flight requests may not be reported yet." +
    (observed.some((a) => a.tracker.approximate) ? " Some request pricing boundaries unavailable; standard-rate approximation included." : ""));
}

function signalChild(proc: ChildProcess, signal: NodeJS.Signals): void {
  if (!proc.pid) return;
  try {
    if (process.platform !== "win32" && !process.argv.includes("--interactive")) process.kill(-proc.pid, signal);
    else proc.kill(signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") console.error(`Failed to stop generator: ${error}`);
  }
}

function stopGeneration(signal: NodeJS.Signals): void {
  if (stopping) {
    for (const proc of activeChildren) signalChild(proc, "SIGKILL");
    return;
  }
  stopping = true;
  process.exitCode = signal === "SIGINT" ? 130 : 143;
  console.log(`\n${signal}: stopping active generators and queued tasks...`);
  for (const proc of activeChildren) signalChild(proc, "SIGTERM");
  reportCost("Stopping (partial)");
  const killTimer = setTimeout(() => {
    for (const proc of activeChildren) signalChild(proc, "SIGKILL");
  }, 5000);
  killTimer.unref();
}

function checkStopped(): void {
  if (stopping) throw new Error("Generation interrupted");
}

// ============================================================================
// Helpers
// ============================================================================

function loadExamples(): ExampleSpec[] {
  const files = fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith(".yaml"));
  return files.map((file) => {
    const content = fs.readFileSync(path.join(EXAMPLES_DIR, file), "utf-8");
    const raw = yaml.parse(content);
    // Only keep known fields — drop screenshot_url and anything else that
    // could cause vision-only API calls against models that don't support images.
    return { id: raw.id, title: raw.title, prompt: raw.prompt, tags: raw.tags } as ExampleSpec;
  });
}

function appFileExists(modelId: string, appId: string): boolean {
  const outputPath = path.join(REPO_ROOT, getAppOutputPath(modelId, appId));
  return fs.existsSync(outputPath);
}

async function appExistsAndValid(modelId: string, appId: string, logPrefix: string): Promise<boolean> {
  const outputPath = path.join(REPO_ROOT, getAppOutputPath(modelId, appId));

  if (!fs.existsSync(outputPath)) {
    return false;
  }

  // Validate the HTML doesn't have errors
  const validation = await validateHtml(outputPath);
  if (!validation.success) {
    console.log(`${logPrefix} ⚠️  Existing file has ${validation.errors.length} error(s), will regenerate`);
    validation.errors.slice(0, 3).forEach((e) => console.log(`${logPrefix}   - ${e}`));
  }

  return validation.success;
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildPrompt(spec: ExampleSpec, interactive: boolean): string {
  const sessionGuidance = interactive
    ? "Work autonomously through the implementation. The user is watching in the interactive harness session."
    : "This is a non-interactive session, so you will not be able to ask clarifying questions. Use your best judgment.";

  return `You are implementing a single self-contained HTML file.

## App: ${spec.title}

## Specification:
${spec.prompt}

## Requirements:
- Create a single index.html file with ALL CSS and JavaScript inlined
- The file must be fully self-contained
- You may use CDN links for libraries (e.g., Tailwind CSS, React, Three.js) if needed
- Place the file at: output/index.html
- Do NOT create any other files

## Important:
${sessionGuidance}

This implementation will be displayed in a competition alongside other AI models' implementations of the same specification. Your implementation should be the highest quality, most polished, and most impressive version possible. Put your best foot forward.

Begin implementation now. DO NOT FORGET TO STORE YOUR OUTPUT IN output/index.html, otherwise it will not count!`;
}

// ============================================================================
// CLI Invocation
// ============================================================================

function readEnvFile(): Record<string, string> | undefined {
  const envPath = path.join(REPO_ROOT, ".env");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^export\s+(\w+)="(.*)"$/);
      if (match) {
        env[match[1]] = match[2];
      }
    }
    return Object.keys(env).length > 0 ? env : undefined;
  } catch {
    return undefined;
  }
}

/** Build env overrides for models served via Fireworks' Anthropic-compatible
 *  endpoint. Reads the base URL
 *  and auth from .env and pins every Claude Code model slot to this model's
 *  id so a single run uses one backend end-to-end.
 */
function buildAnthropicProxyEnv(model: ModelConfig): EnvOverrides | undefined {
  const base = readEnvFile();
  if (!base) return undefined;

  const result: Record<string, string> = {};

  // ANTHROPIC_AUTH_TOKEN is the variable most proxy providers document;
  // Claude Code reads ANTHROPIC_API_KEY. Accept either in .env.
  if (base.ANTHROPIC_BASE_URL) result.ANTHROPIC_BASE_URL = base.ANTHROPIC_BASE_URL;
  const apiKey = base.ANTHROPIC_API_KEY || base.ANTHROPIC_AUTH_TOKEN;
  if (apiKey) result.ANTHROPIC_API_KEY = apiKey;

  // Pin every Claude Code model slot to this model id so internal
  // sub-model calls (sonnet/haiku/opus defaults) also go through the proxy.
  const modelId = model.model;
  result.ANTHROPIC_MODEL = modelId;
  result.ANTHROPIC_SMALL_FAST_MODEL = modelId;
  result.ANTHROPIC_DEFAULT_SONNET_MODEL = modelId;
  result.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelId;
  result.ANTHROPIC_DEFAULT_OPUS_MODEL = modelId;

  return result;
}

/** Read OpenRouter auth for either Claude's proxy environment or OpenCode.
 *  OpenCode can also fall back to credentials stored by `opencode auth login`.
 */
function getOpenRouterApiKey(): string | undefined {
  const fileEnv = readEnvFile();
  return process.env.OPENROUTER_API_KEY || fileEnv?.OPENROUTER_API_KEY;
}

function createTempDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "arena-gen-"));
  // Initialize a git repo so CLI tools don't complain
  execSync("git init", { cwd: tempDir, stdio: "ignore" });
  return tempDir;
}

function cleanupTempDir(tempDir: string): void {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// HTML Validation with Puppeteer
// ============================================================================

interface ValidationResult {
  success: boolean;
  errors: string[];
}

let puppeteer: typeof import("puppeteer") | null = null;

async function loadPuppeteer(): Promise<typeof import("puppeteer") | null> {
  if (puppeteer !== null) return puppeteer;
  try {
    puppeteer = await import("puppeteer");
    return puppeteer;
  } catch {
    return null;
  }
}

async function validateHtml(htmlPath: string): Promise<ValidationResult> {
  const pptr = await loadPuppeteer();
  if (!pptr) {
    // Puppeteer not available, skip validation
    return { success: true, errors: [] };
  }

  const errors: string[] = [];
  let browser;

  try {
    browser = await pptr.launch({ headless: true });
    const page = await browser.newPage();

    // Collect console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(`Console error: ${msg.text()}`);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on("pageerror", (err) => {
      errors.push(`Page error: ${err instanceof Error ? err.message : String(err)}`);
    });

    // Load the HTML file
    const fileUrl = `file://${htmlPath}`;
    await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait a bit for any async JS to run
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await browser.close();
  } catch (err) {
    errors.push(`Validation error: ${err}`);
    if (browser) await browser.close();
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

function buildFixPrompt(spec: ExampleSpec, errors: string[]): string {
  const sanitizedErrors = errors.map((error) => error.replaceAll("\0", "\\0"));

  return `The HTML file you created has JavaScript errors. Please fix them.

## Original App: ${spec.title}

## Errors found:
${sanitizedErrors.map((e) => `- ${e}`).join("\n")}

## Instructions:
1. Read the current output/index.html file
2. Fix the JavaScript errors listed above
3. Save the fixed version to output/index.html

Do not rewrite the entire file from scratch - just fix the errors.`;
}

async function runCliOnce(
  model: ModelConfig,
  prompt: string,
  tempDir: string,
  logPrefix: string,
  interactive: boolean
): Promise<void> {
  checkStopped();
  const { cmd, args, env } = buildHarnessCommand(model, prompt, {
    interactive,
    codexLauncher,
    anthropicProxyEnv:
      model.host === "fireworks" ? buildAnthropicProxyEnv(model) : undefined,
    openRouterApiKey:
      model.host === "openrouter" ? getOpenRouterApiKey() : undefined,
  });

  const spawnEnv = buildHarnessSpawnEnv(model, env);

  const attempt = model.model === "gpt-6-astra"
    ? { label: logPrefix, tracker: new CodexCostTracker(), finished: false }
    : undefined;
  if (attempt) costAttempts.push(attempt);
  const monitor = model.harness === "codex" ? new CodexUsageMonitor(
    path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions"),
    attempt?.tracker,
    (message) => console.log(`${logPrefix} ${message}`),
    () => {
      if (!attempt) return;
      const appTotal = costAttempts.filter((a) => a.label === logPrefix).reduce((sum, a) => sum + a.tracker.usd, 0);
      costLog(`${logPrefix} app so far: $${appTotal.toFixed(4)} USD (including repair attempts)`);
      reportCost("Run so far");
    },
  ) : undefined;

  try {
    await new Promise<void>((resolve, reject) => {
      console.log(`${logPrefix} Running in sandbox: ${tempDir}`);
      // Log the exact --model flag actually passed to the CLI so a run can be
      // audited against the intended model (guards against silent CLI fallbacks).
      const modelFlagIdx = args.indexOf("--model");
      const invokedModel = modelFlagIdx !== -1 ? args[modelFlagIdx + 1] : "(no --model flag)";
      const invocationMode = interactive ? "(interactive)" : "(non-interactive)";
      console.log(`${logPrefix} Command: ${cmd} ${invocationMode} --model ${invokedModel} ...`);
      if (model.variant) console.log(`${logPrefix} Reasoning/variant: ${model.variant}`);
      if (interactive) {
        console.log(`${logPrefix} Exit the harness when it finishes to continue validation (do not press Ctrl+C).`);
      }

      const proc = spawn(cmd, args, {
        stdio: monitor ? ["ignore", "pipe", "inherit"] : "inherit",
        cwd: tempDir,
        env: spawnEnv,
        detached: !interactive && process.platform !== "win32",
      });
      activeChildren.add(proc);
      proc.stdout?.on("data", (chunk: Buffer) => monitor?.push(chunk));

      proc.on("close", (code, signal) => {
        activeChildren.delete(proc);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`CLI exited with ${signal || `code ${code}`}`));
        }
      });

      proc.on("error", (err) => {
        activeChildren.delete(proc);
        reject(err);
      });
    });
  } finally {
    monitor?.finish();
    if (attempt) {
      attempt.finished = true;
      costLog(`${logPrefix} attempt ended: ${attempt.tracker.observed ? `$${attempt.tracker.usd.toFixed(4)} USD estimated` : "usage unavailable"}`);
    }
  }
  checkStopped();
}

async function runCliInSandbox(
  model: ModelConfig,
  prompt: string,
  destPath: string,
  spec: ExampleSpec,
  logPrefix: string,
  { interactive, maxRetries = 2 }: SandboxRunOptions
): Promise<void> {
  const tempDir = createTempDir();
  const tempOutputDir = path.join(tempDir, "output");
  const tempOutputFile = path.join(tempOutputDir, "index.html");

  // Create the output directory structure in temp
  fs.mkdirSync(tempOutputDir, { recursive: true });

  try {
    // Initial generation
    await runCliOnce(model, prompt, tempDir, logPrefix, interactive);

    if (!fs.existsSync(tempOutputFile)) {
      throw new Error(`CLI completed but output/index.html was not created in sandbox`);
    }

    // Validate and retry if needed
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      checkStopped();
      const validation = await validateHtml(tempOutputFile);

      if (validation.success) {
        break;
      }

      console.log(`${logPrefix} ⚠️  Validation found ${validation.errors.length} error(s), attempting fix (${attempt + 1}/${maxRetries})...`);
      validation.errors.slice(0, 5).forEach((e) => console.log(`${logPrefix}   - ${e}`));

      // Run CLI again with fix prompt
      const fixPrompt = buildFixPrompt(spec, validation.errors);
      await runCliOnce(model, fixPrompt, tempDir, logPrefix, interactive);
    }

    // Final validation (just for logging)
    const finalValidation = await validateHtml(tempOutputFile);
    if (!finalValidation.success) {
      console.log(`${logPrefix} ⚠️  Still has ${finalValidation.errors.length} error(s) after ${maxRetries} fix attempts`);
    }

    // Copy the output file to the final destination
    checkStopped();
    ensureDir(destPath);
    fs.copyFileSync(tempOutputFile, destPath);
    console.log(`${logPrefix} Copied output to: ${destPath}`);
  } finally {
    cleanupTempDir(tempDir);
  }
}

// ============================================================================
// Main Generation Loop
// ============================================================================

async function generateApp(
  model: ModelConfig,
  spec: ExampleSpec,
  options: GenerateOptions
): Promise<"skipped" | "generated" | "failed"> {
  const outputPath = getAppOutputPath(model.id, spec.id);
  const absoluteOutputPath = path.join(REPO_ROOT, outputPath);
  const logPrefix = `[${model.id}/${spec.id}]`;
  if (stopping) return "skipped";

  // Check if app exists and should be skipped
  const forceRegenerate = options.forceAll || options.force.includes(spec.id);
  if (!forceRegenerate && await appExistsAndValid(model.id, spec.id, logPrefix)) {
    return "skipped";
  }

  // Build the prompt (agents write to output/index.html in their sandbox)
  const prompt = buildPrompt(spec, options.interactive);

  try {
    // Run CLI in isolated temp directory, then copy result to final location
    await runCliInSandbox(
      model,
      prompt,
      absoluteOutputPath,
      spec,
      logPrefix,
      { interactive: options.interactive }
    );

    // Verify the file was created
    if (fs.existsSync(absoluteOutputPath)) {
      return "generated";
    } else {
      console.error(
        `${logPrefix} WARNING: CLI completed but ${outputPath} was not created`
      );
      return "failed";
    }
  } catch (error) {
    console.error(`${logPrefix} ERROR: ${error}`);
    return "failed";
  }
}

async function main(): Promise<void> {
  // Check token limits on startup
  checkTokenLimits();

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const options: GenerateOptions = {
    force: [],
    forceAll: false,
    modelFilter: [],
    concurrency: 1,
    interactive: args.includes("--interactive"),
  };

  // Parse --force-all flag
  if (args.includes("--force-all")) {
    options.forceAll = true;
  }

  // Parse --concurrency flag
  const concurrencyIndex = args.indexOf("--concurrency");
  if (concurrencyIndex !== -1 && args[concurrencyIndex + 1]) {
    const n = parseInt(args[concurrencyIndex + 1], 10);
    if (n > 0) options.concurrency = n;
  }

  // Parse --force flag
  const forceIndex = args.indexOf("--force");
  if (forceIndex !== -1) {
    // Collect all args after --force until the next flag or end
    for (let i = forceIndex + 1; i < args.length; i++) {
      if (args[i].startsWith("--")) break;
      options.force.push(args[i]);
    }
  }

  // Parse positional args as model IDs (matches on id or model field)
  for (const arg of args) {
    if (arg.startsWith("--")) break;
    const model = models.find(m => m.id === arg || m.model === arg);
    if (model) {
      options.modelFilter.push(model.id);
    } else {
      console.error(`Unknown model: "${arg}". Available models: ${models.map(m => m.id).join(", ")}`);
      process.exit(1);
    }
  }

  // Determine which models to generate for
  const targetModels = options.modelFilter.length > 0
    ? models.filter(m => options.modelFilter.includes(m.id))
    : models;

  if (options.interactive && options.concurrency !== 1) {
    console.error(
      "--interactive requires --concurrency 1 so the harness can own the terminal."
    );
    process.exit(1);
  }

  if (options.interactive && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    console.error("--interactive requires a terminal. Run it directly without piping or redirecting output.");
    process.exit(1);
  }

  const nonInteractiveModels = targetModels.filter(
    (model) => !["claude", "opencode"].includes(model.harness)
  );
  if (options.interactive && nonInteractiveModels.length > 0) {
    console.error(
      `--interactive only supports Claude and OpenCode harnesses. Unsupported: ${nonInteractiveModels.map((model) => model.id).join(", ")}`
    );
    process.exit(1);
  }

  // Load all examples
  const examples = loadExamples();
  const targetExamples = options.force.length > 0
    ? examples.filter(e => options.force.includes(e.id))
    : examples;
  const taskCount = targetModels.length * targetExamples.length;

  if (options.interactive && taskCount !== 1) {
    console.error(
      `--interactive requires exactly one model/app task, but ${taskCount} resolved. ` +
        "Choose one model and one existing app with --force."
    );
    process.exit(1);
  }

  console.log(`Found ${examples.length} examples`);
  console.log(`Found ${targetModels.length} model(s) to generate for (${models.length} total)`);

  if (options.modelFilter.length > 0) {
    console.log(`Models: ${options.modelFilter.join(", ")}`);
  } else {
    console.log(`Models: all`);
  }

  if (options.force.length > 0) {
    console.log(`Apps: ${options.force.join(", ")} (forced)`);
  } else if (options.forceAll) {
    console.log(`Apps: all (forced)`);
  } else {
    console.log(`Apps: all (skipping existing)`);
  }

  console.log(`Total tasks: ${taskCount}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log(`Harness mode: ${options.interactive ? "interactive" : "non-interactive"}`);
  console.log();

  if (taskCount > 0 && targetModels.some((model) => model.harness === "codex")) {
    codexLauncher = await prepareCodex(REPO_ROOT);
  }
  const pricedModel = targetModels.find((model) => model.model === "gpt-6-astra");
  if (taskCount > 0 && pricedModel) {
    costLogPath = path.join(REPO_ROOT, "logs", `generate-${new Date().toISOString().replaceAll(":", "-")}-${process.pid}.log`);
    ensureDir(costLogPath);
    costLog(`Astra standard API rates per 1M tokens: input $10, cached input $1, cache writes $12.50, output $50. Long-context multipliers apply above 272K input per request. Subscription billing may differ. Other models are not priced.`);
    costLog(`Codex launcher: ${codexLauncher}; model: ${pricedModel.model}; reasoning: ${pricedModel.variant || "default"}; service tier: default`);
    console.log(`Local cost log: ${costLogPath}`);
  }
  const onInterrupt = () => stopGeneration("SIGINT");
  const onTerminate = () => stopGeneration("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  const costTimer = setInterval(() => reportCost("Run so far"), 15_000);
  costTimer.unref();

  try {

    // Track stats
    const stats = {
      skipped: 0,
      generated: 0,
      failed: 0,
    };

    // Build list of tasks (filtered by --force if specified)
    const tasks: Array<{ model: ModelConfig; spec: ExampleSpec }> = [];

    for (const model of targetModels) {
      for (const spec of targetExamples) {
        tasks.push({ model, spec });
      }
    }

    // Process tasks with concurrency limit
    const runTask = async (task: { model: ModelConfig; spec: ExampleSpec }) => {
      const { model, spec } = task;
      const logPrefix = `[${model.id}/${spec.id}]`;
      console.log(`\n${logPrefix} ${spec.title}`);

      const result = await generateApp(model, spec, options);
      stats[result]++;

      switch (result) {
        case "skipped":
          console.log(`${logPrefix} Skipped (already exists)`);
          break;
        case "generated":
          console.log(`${logPrefix} ✓ Generated successfully`);
          break;
        case "failed":
          console.log(`${logPrefix} ✗ FAILED`);
          break;
      }
    };

    // Simple concurrency pool
    const pool: Promise<void>[] = [];
    for (const task of tasks) {
      if (stopping) break;
      const promise = runTask(task).then(() => {
        pool.splice(pool.indexOf(promise), 1);
      });
      pool.push(promise);

      if (pool.length >= options.concurrency) {
        await Promise.race(pool);
      }
    }
    await Promise.all(pool);

    // Print summary
    console.log(`\n${"=".repeat(60)}`);
    console.log("SUMMARY");
    console.log(`${"=".repeat(60)}`);
    console.log(`  Generated: ${stats.generated}`);
    console.log(`  Skipped:   ${stats.skipped}`);
    console.log(`  Failed:    ${stats.failed}`);
    console.log();
  } finally {
    clearInterval(costTimer);
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
    reportCost(stopping ? "Final (interrupted; partial)" : "Final");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
