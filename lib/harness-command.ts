import type { ModelConfig } from "./models.config.ts";

export type EnvOverrides = Record<string, string | undefined>;

export const MAX_OUTPUT_TOKENS = {
  claude: 128000,
  codex: 100000,
  opencode: 131072,
} as const;

export interface HarnessCommandOptions {
  interactive: boolean;
  anthropicProxyEnv?: EnvOverrides;
  openRouterApiKey?: string;
}

export interface HarnessCommand {
  cmd: string;
  args: string[];
  env?: EnvOverrides;
}

const OPENROUTER_ANTHROPIC_BASE_URL = "https://openrouter.ai/api";

export const OPENCODE_UNRESTRICTED_CONFIG = {
  permission: {
    "*": "allow",
  },
} as const;

const OPENCODE_UNRESTRICTED_CONFIG_CONTENT = JSON.stringify(
  OPENCODE_UNRESTRICTED_CONFIG
);

// Runtime and auth-store discovery variables that are safe to expose to the
// OpenCode process. Provider credentials are supplied separately in the
// command-specific overrides, so unrelated parent secrets are not inherited.
const OPENCODE_PARENT_ENV_ALLOWLIST = [
  "PATH",
  "Path",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "XDG_DATA_HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "FORCE_COLOR",
  "USER",
  "LOGNAME",
  "SHELL",
] as const;

function requireOpenRouterApiKey(
  model: ModelConfig,
  apiKey: string | undefined
): string {
  if (!apiKey) {
    throw new Error(
      `OPENROUTER_API_KEY is not set (checked process.env and .env). ` +
        `Required to run OpenRouter model "${model.id}" with Claude.`
    );
  }

  return apiKey;
}

function buildClaudeOpenRouterEnv(
  model: ModelConfig,
  apiKey: string | undefined
): EnvOverrides {
  const key = requireOpenRouterApiKey(model, apiKey);
  const modelId = model.model;

  return {
    ANTHROPIC_BASE_URL: OPENROUTER_ANTHROPIC_BASE_URL,
    ANTHROPIC_API_KEY: key,
    ANTHROPIC_AUTH_TOKEN: undefined,
    ANTHROPIC_MODEL: modelId,
    ANTHROPIC_SMALL_FAST_MODEL: modelId,
    ANTHROPIC_DEFAULT_SONNET_MODEL: modelId,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: modelId,
    ANTHROPIC_DEFAULT_OPUS_MODEL: modelId,
  };
}

function buildClaudeArgs(
  model: ModelConfig,
  prompt: string,
  interactive: boolean,
  proxy: boolean
): string[] {
  return [
    ...(interactive ? [] : ["-p"]),
    ...(proxy ? ["--bare"] : []),
    "--model",
    model.model,
    "--max-turns",
    "500",
    "--dangerously-skip-permissions",
    "--permission-mode",
    "bypassPermissions",
    ...(proxy && model.supportsVision === false
      ? ["--disallowed-tools", "computer_20250124", "--"]
      : []),
    prompt,
  ];
}

function buildOpenCodeCommand(
  model: ModelConfig,
  prompt: string,
  options: HarnessCommandOptions
): HarnessCommand {
  const modelId = `${model.host}/${model.model}`;
  const variantArgs = model.variant ? ["--variant", model.variant] : [];
  const env: EnvOverrides = {
    OPENCODE_CONFIG_CONTENT: OPENCODE_UNRESTRICTED_CONFIG_CONTENT,
    OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX: String(MAX_OUTPUT_TOKENS.opencode),
    ...(model.host === "openrouter" && options.openRouterApiKey
      ? { OPENROUTER_API_KEY: options.openRouterApiKey }
      : {}),
  };

  if (options.interactive) {
    return {
      cmd: "opencode",
      args: ["--pure", ...variantArgs, "--model", modelId, "--prompt", prompt],
      env,
    };
  }

  return {
    cmd: "opencode",
    args: ["run", "--pure", ...variantArgs, "--model", modelId, prompt],
    env,
  };
}

/**
 * Build the environment passed to a harness process. Existing harnesses retain
 * their environment contract; OpenCode gets only basic runtime/auth-store
 * discovery variables plus its explicit command overrides.
 */
export function buildHarnessSpawnEnv(
  model: ModelConfig,
  commandEnv: EnvOverrides | undefined,
  parentEnv: EnvOverrides = process.env
): NodeJS.ProcessEnv {
  const spawnEnv: EnvOverrides =
    model.harness === "opencode"
      ? Object.fromEntries(
          OPENCODE_PARENT_ENV_ALLOWLIST.flatMap((key) =>
            parentEnv[key] === undefined ? [] : [[key, parentEnv[key]]]
          )
        )
      : {
          ...parentEnv,
          CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(MAX_OUTPUT_TOKENS.claude),
        };

  Object.assign(spawnEnv, commandEnv);
  for (const [key, value] of Object.entries(spawnEnv)) {
    if (value === undefined) delete spawnEnv[key];
  }

  return spawnEnv as NodeJS.ProcessEnv;
}

export function buildHarnessCommand(
  model: ModelConfig,
  prompt: string,
  options: HarnessCommandOptions
): HarnessCommand {
  switch (model.harness) {
    case "claude": {
      if (model.host === "fireworks" || model.host === "openrouter") {
        return {
          cmd: "claude",
          args: buildClaudeArgs(model, prompt, options.interactive, true),
          env:
            model.host === "openrouter"
              ? buildClaudeOpenRouterEnv(model, options.openRouterApiKey)
              : options.anthropicProxyEnv,
        };
      }

      return {
        cmd: "claude",
        args: buildClaudeArgs(model, prompt, options.interactive, false),
      };
    }

    case "codex":
      return {
        cmd: "codex",
        args: [
          "exec",
          "--model",
          model.model,
          "--full-auto",
          "-c",
          `model_max_output_tokens=${MAX_OUTPUT_TOKENS.codex}`,
          prompt,
        ],
      };

    case "gemini":
      return {
        cmd: "gemini",
        args: [
          "--model",
          model.model,
          "--approval-mode",
          "yolo",
          "--skip-trust",
          prompt,
        ],
      };

    case "opencode":
      return buildOpenCodeCommand(model, prompt, options);

    default: {
      const exhaustiveCheck: never = model.harness;
      throw new Error(`Unknown harness: ${exhaustiveCheck}`);
    }
  }
}
