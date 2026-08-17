import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { getModel, models, publishedModels } from "../lib/models.config.ts";
import {
  buildHarnessCommand,
  buildHarnessSpawnEnv,
  MAX_OUTPUT_TOKENS,
  OPENCODE_UNRESTRICTED_CONFIG,
} from "../lib/harness-command.ts";

test("configures Qwen3.8 27B for OpenCode through OpenRouter", () => {
  const model = getModel("qwen-3.8-27b");

  assert.deepEqual(model, {
    id: "qwen-3.8-27b",
    name: "Qwen3.8 27B",
    harness: "opencode",
    host: "openrouter",
    model: "qwen/qwen3.8-27b",
    variant: "xhigh",
    color: "bg-cyan-700",
    provider: "qwen",
    published: true,
  });
});

test("publishes Qwen in the public UI model list", () => {
  assert.ok(models.some((model) => model.id === "qwen-3.8-27b"));
  assert.ok(publishedModels.some((model) => model.id === "qwen-3.8-27b"));
});

test("preserves exact harness commands and provider environments", () => {
  const prompt = "Build the app";
  const fireworksEnv = {
    ANTHROPIC_BASE_URL: "https://fireworks.example.test",
    ANTHROPIC_API_KEY: "test-fireworks-key",
  };
  const openRouterEnv = {
    ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
    ANTHROPIC_API_KEY: "test-openrouter-key",
    ANTHROPIC_AUTH_TOKEN: undefined,
    ANTHROPIC_MODEL: "moonshotai/kimi-k3",
    ANTHROPIC_SMALL_FAST_MODEL: "moonshotai/kimi-k3",
    ANTHROPIC_DEFAULT_SONNET_MODEL: "moonshotai/kimi-k3",
    ANTHROPIC_DEFAULT_HAIKU_MODEL: "moonshotai/kimi-k3",
    ANTHROPIC_DEFAULT_OPUS_MODEL: "moonshotai/kimi-k3",
  };
  const openCodeEnv = {
    OPENCODE_CONFIG_CONTENT: JSON.stringify(OPENCODE_UNRESTRICTED_CONFIG),
    OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: String(MAX_OUTPUT_TOKENS.opencode),
    OPENROUTER_API_KEY: "test-openrouter-key",
  };

  const cases = [
    {
      name: "direct Claude",
      modelId: "opus-5",
      options: { interactive: false },
      expected: {
        cmd: "claude",
        args: [
          "-p",
          "--model",
          "claude-opus-5",
          "--max-turns",
          "500",
          "--dangerously-skip-permissions",
          "--permission-mode",
          "bypassPermissions",
          prompt,
        ],
      },
    },
    {
      name: "Codex",
      modelId: "gpt-5",
      options: { interactive: false },
      expected: {
        cmd: "codex",
        args: [
          "exec",
          "--model",
          "gpt-5",
          "--full-auto",
          "-c",
          "model_max_output_tokens=100000",
          prompt,
        ],
      },
    },
    {
      name: "Gemini",
      modelId: "gemini-3",
      options: { interactive: false },
      expected: {
        cmd: "gemini",
        args: [
          "--model",
          "gemini-3-pro-preview",
          "--approval-mode",
          "yolo",
          "--skip-trust",
          prompt,
        ],
      },
    },
    {
      name: "Fireworks Claude proxy",
      modelId: "kimi-k2.6",
      options: { interactive: false, anthropicProxyEnv: fireworksEnv },
      expected: {
        cmd: "claude",
        args: [
          "-p",
          "--bare",
          "--model",
          "accounts/fireworks/models/kimi-k2p6",
          "--max-turns",
          "500",
          "--dangerously-skip-permissions",
          "--permission-mode",
          "bypassPermissions",
          prompt,
        ],
        env: fireworksEnv,
      },
    },
    {
      name: "Claude through OpenRouter",
      modelId: "kimi-k3",
      options: { interactive: false, openRouterApiKey: "test-openrouter-key" },
      expected: {
        cmd: "claude",
        args: [
          "-p",
          "--bare",
          "--model",
          "moonshotai/kimi-k3",
          "--max-turns",
          "500",
          "--dangerously-skip-permissions",
          "--permission-mode",
          "bypassPermissions",
          prompt,
        ],
        env: openRouterEnv,
      },
    },
    {
      name: "OpenCode noninteractive",
      modelId: "qwen-3.8-27b",
      options: { interactive: false, openRouterApiKey: "test-openrouter-key" },
      expected: {
        cmd: "opencode",
        args: [
          "run",
          "--pure",
          "--variant",
          "xhigh",
          "--model",
          "openrouter/qwen/qwen3.8-27b",
          prompt,
        ],
        env: openCodeEnv,
      },
    },
    {
      name: "OpenCode interactive",
      modelId: "qwen-3.8-27b",
      options: { interactive: true, openRouterApiKey: "test-openrouter-key" },
      expected: {
        cmd: "opencode",
        args: [
          "--pure",
          "--variant",
          "xhigh",
          "--model",
          "openrouter/qwen/qwen3.8-27b",
          "--prompt",
          prompt,
        ],
        env: openCodeEnv,
      },
    },
  ];

  for (const testCase of cases) {
    const model = getModel(testCase.modelId);
    assert.ok(model, `${testCase.name} model is configured`);
    assert.deepEqual(
      buildHarnessCommand(model, prompt, testCase.options),
      testCase.expected,
      testCase.name
    );
  }
});

test("rejects missing credentials for Claude through OpenRouter", () => {
  const model = getModel("kimi-k3");
  assert.ok(model);

  assert.throws(
    () => buildHarnessCommand(model, "Build the app", { interactive: false }),
    /OPENROUTER_API_KEY is not set/
  );
});

test("lets OpenCode use credentials from its auth store", () => {
  const model = getModel("qwen-3.8-27b");
  assert.ok(model);

  const command = buildHarnessCommand(model, "Build the app", {
    interactive: false,
  });

  assert.equal(command.cmd, "opencode");
  assert.equal(command.env?.OPENROUTER_API_KEY, undefined);
  assert.equal(
    command.env?.OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX,
    String(MAX_OUTPUT_TOKENS.opencode)
  );
});

test("lets OpenCode use the model's full OpenRouter output capacity", () => {
  assert.equal(MAX_OUTPUT_TOKENS.opencode, 131072);
});

test("gives OpenCode unrestricted tool permissions like the other harnesses", () => {
  assert.deepEqual(OPENCODE_UNRESTRICTED_CONFIG.permission, {
    "*": "allow",
  });
});

test("scrubs unrelated secrets from the OpenCode child environment", () => {
  const model = getModel("qwen-3.8-27b");
  assert.ok(model);

  const command = buildHarnessCommand(model, "Build the app", {
    interactive: false,
    openRouterApiKey: "test-openrouter-key",
  });
  const spawnEnv = buildHarnessSpawnEnv(model, command.env, {
    PATH: "/usr/bin:/bin",
    HOME: "/Users/tester",
    XDG_DATA_HOME: "/Users/tester/.local/share",
    OPENAI_API_KEY: "must-not-leak",
    ANTHROPIC_API_KEY: "must-not-leak",
    AWS_SECRET_ACCESS_KEY: "must-not-leak",
  });

  assert.equal(spawnEnv.PATH, "/usr/bin:/bin");
  assert.equal(spawnEnv.HOME, "/Users/tester");
  assert.equal(spawnEnv.XDG_DATA_HOME, "/Users/tester/.local/share");
  assert.equal(spawnEnv.OPENROUTER_API_KEY, "test-openrouter-key");
  assert.equal(
    spawnEnv.OPENCODE_CONFIG_CONTENT,
    JSON.stringify(OPENCODE_UNRESTRICTED_CONFIG)
  );
  assert.equal(
    spawnEnv.OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX,
    String(MAX_OUTPUT_TOKENS.opencode)
  );
  assert.equal(spawnEnv.OPENAI_API_KEY, undefined);
  assert.equal(spawnEnv.ANTHROPIC_API_KEY, undefined);
  assert.equal(spawnEnv.AWS_SECRET_ACCESS_KEY, undefined);
});

test("installed OpenCode accepts the flags used by generation", (t) => {
  const tuiHelp = spawnSync("opencode", ["--help"], { encoding: "utf8" });
  if (tuiHelp.error?.code === "ENOENT") {
    t.skip("OpenCode is not installed");
    return;
  }
  assert.ifError(tuiHelp.error);
  assert.equal(tuiHelp.status, 0, tuiHelp.stderr);

  const runHelp = spawnSync("opencode", ["run", "--help"], { encoding: "utf8" });
  assert.ifError(runHelp.error);
  assert.equal(runHelp.status, 0, runHelp.stderr);

  const tuiOutput = `${tuiHelp.stdout}${tuiHelp.stderr}`;
  const runOutput = `${runHelp.stdout}${runHelp.stderr}`;
  assert.match(tuiOutput, /--pure\b/);
  assert.match(tuiOutput, /--model\b/);
  assert.match(tuiOutput, /--prompt\b/);
  assert.match(runOutput, /--pure\b/);
  assert.match(runOutput, /--variant\b/);
  assert.match(runOutput, /--model\b/);
});
