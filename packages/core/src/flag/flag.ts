import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["LOCKCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["LOCKCODE_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("LOCKCODE_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  LOCKCODE_AUTO_HEAP_SNAPSHOT: truthy("LOCKCODE_AUTO_HEAP_SNAPSHOT"),
  LOCKCODE_GIT_BASH_PATH: process.env["LOCKCODE_GIT_BASH_PATH"],
  LOCKCODE_CONFIG: process.env["LOCKCODE_CONFIG"],
  LOCKCODE_CONFIG_CONTENT: process.env["LOCKCODE_CONFIG_CONTENT"],
  LOCKCODE_DISABLE_AUTOUPDATE: truthy("LOCKCODE_DISABLE_AUTOUPDATE"),
  LOCKCODE_ALWAYS_NOTIFY_UPDATE: truthy("LOCKCODE_ALWAYS_NOTIFY_UPDATE"),
  LOCKCODE_DISABLE_PRUNE: truthy("LOCKCODE_DISABLE_PRUNE"),
  LOCKCODE_DISABLE_TERMINAL_TITLE: truthy("LOCKCODE_DISABLE_TERMINAL_TITLE"),
  LOCKCODE_SHOW_TTFD: truthy("LOCKCODE_SHOW_TTFD"),
  LOCKCODE_DISABLE_AUTOCOMPACT: truthy("LOCKCODE_DISABLE_AUTOCOMPACT"),
  LOCKCODE_DISABLE_MODELS_FETCH: truthy("LOCKCODE_DISABLE_MODELS_FETCH"),
  LOCKCODE_DISABLE_MOUSE: truthy("LOCKCODE_DISABLE_MOUSE"),
  LOCKCODE_FAKE_VCS: process.env["LOCKCODE_FAKE_VCS"],
  LOCKCODE_SERVER_PASSWORD: process.env["LOCKCODE_SERVER_PASSWORD"],
  LOCKCODE_SERVER_USERNAME: process.env["LOCKCODE_SERVER_USERNAME"],
  LOCKCODE_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("LOCKCODE_DISABLE_FFF"),

  // Experimental
  LOCKCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("LOCKCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  LOCKCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("LOCKCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  LOCKCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("LOCKCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  LOCKCODE_MODELS_URL: process.env["LOCKCODE_MODELS_URL"],
  LOCKCODE_MODELS_PATH: process.env["LOCKCODE_MODELS_PATH"],
  LOCKCODE_DB: process.env["LOCKCODE_DB"],

  LOCKCODE_WORKSPACE_ID: process.env["LOCKCODE_WORKSPACE_ID"],
  LOCKCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("LOCKCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get LOCKCODE_DISABLE_PROJECT_CONFIG() {
    return truthy("LOCKCODE_DISABLE_PROJECT_CONFIG")
  },
  get LOCKCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("LOCKCODE_EXPERIMENTAL_REFERENCES")
  },
  get LOCKCODE_TUI_CONFIG() {
    return process.env["LOCKCODE_TUI_CONFIG"]
  },
  get LOCKCODE_CONFIG_DIR() {
    return process.env["LOCKCODE_CONFIG_DIR"]
  },
  get LOCKCODE_PURE() {
    return truthy("LOCKCODE_PURE")
  },
  get LOCKCODE_PERMISSION() {
    return process.env["LOCKCODE_PERMISSION"]
  },
  get LOCKCODE_PLUGIN_META_FILE() {
    return process.env["LOCKCODE_PLUGIN_META_FILE"]
  },
  get LOCKCODE_CLIENT() {
    return process.env["LOCKCODE_CLIENT"] ?? "cli"
  },
}
