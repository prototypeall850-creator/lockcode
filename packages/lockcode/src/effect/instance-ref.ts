import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@lockcode-ai/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~lockcode/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~lockcode/WorkspaceRef", {
  defaultValue: () => undefined,
})
