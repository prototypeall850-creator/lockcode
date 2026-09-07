import { run as runTui, type TuiInput } from "@lockcode-ai/tui"
import { Global } from "@lockcode-ai/core/global"
import { AppNodeBuilder } from "@lockcode-ai/core/effect/app-node-builder"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(AppNodeBuilder.build(Global.node)))
}
