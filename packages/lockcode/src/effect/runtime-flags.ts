import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("LOCKCODE_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@lockcode/RuntimeFlags", {
  autoShare: bool("LOCKCODE_AUTO_SHARE"),
  pure: bool("LOCKCODE_PURE"),
  disableDefaultPlugins: bool("LOCKCODE_DISABLE_DEFAULT_PLUGINS"),
  disableEmbeddedWebUi: bool("LOCKCODE_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("LOCKCODE_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("LOCKCODE_DISABLE_LSP_DOWNLOAD"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("LOCKCODE_DISABLE_CLAUDE_CODE"),
    direct: bool("LOCKCODE_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("LOCKCODE_DISABLE_CLAUDE_CODE"),
    direct: bool("LOCKCODE_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("LOCKCODE_ENABLE_EXA"),
    legacy: bool("LOCKCODE_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("LOCKCODE_ENABLE_PARALLEL"),
    legacy: bool("LOCKCODE_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("LOCKCODE_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("LOCKCODE_ENABLE_QUESTION_TOOL"),
  experimentalReferences: enabledByExperimental("LOCKCODE_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: enabledByExperimental("LOCKCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("LOCKCODE_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("LOCKCODE_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("LOCKCODE_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("LOCKCODE_EXPERIMENTAL_PLAN_MODE"),
  experimentalCodeMode: enabledByExperimental("LOCKCODE_EXPERIMENTAL_CODE_MODE"),
  experimentalEventSystem: enabledByExperimental("LOCKCODE_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("LOCKCODE_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("LOCKCODE_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("LOCKCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("LOCKCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("LOCKCODE_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("LOCKCODE_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("LOCKCODE_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.layer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const node = LayerNode.make({ service: Service, layer: Service.layer.pipe(Layer.orDie), deps: [] })

export * as RuntimeFlags from "./runtime-flags"
import { LayerNode } from "@lockcode-ai/core/effect/layer-node"
