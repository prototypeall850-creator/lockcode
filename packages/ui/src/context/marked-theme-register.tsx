import { registerCustomTheme } from "@pierre/diffs"
import { LockCodeTheme } from "./marked-theme"

let registered = false

export function registerLockCodeTheme() {
  if (registered) return
  registered = true
  registerCustomTheme("LockCode", () => Promise.resolve(LockCodeTheme))
}
