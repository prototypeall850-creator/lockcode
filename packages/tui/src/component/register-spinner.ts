import { getComponentCatalogue } from "@opentui/solid/components"
import { registerSpinner } from "opentui-spinner/solid"

export function registerLockcodeSpinner() {
  if (!getComponentCatalogue().spinner) registerSpinner()
}
