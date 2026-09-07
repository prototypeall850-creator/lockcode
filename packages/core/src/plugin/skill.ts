/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeLockcodeContent from "./skill/customize-lockcode.md" with { type: "text" }

export const CustomizeLockcodeContent = customizeLockcodeContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-lockcode",
            description:
              "Use ONLY when the user is editing or creating lockcode's own configuration: lockcode.json, lockcode.jsonc, files under .lockcode/, or files under ~/.config/lockcode/. Also use when creating or fixing lockcode agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring lockcode itself.",
            location: AbsolutePath.make("/builtin/customize-lockcode.md"),
            content: CustomizeLockcodeContent,
          }),
        }),
      )
    })
  }),
})
