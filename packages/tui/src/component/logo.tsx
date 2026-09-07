import { RGBA, TextAttributes } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { tint, useTheme } from "../context/theme"
import { artSegments } from "../logo"

const FGS: Record<string, [number, number, number]> = {
  "37": [192, 192, 192],
  "93": [255, 255, 85],
  "97": [255, 255, 255],
  "91": [255, 95, 95],
  "31": [170, 0, 0],
}

const BGS: Record<string, [number, number, number]> = {
  "43": [255, 255, 85],
  "47": [255, 255, 255],
  "41": [255, 95, 95],
}

export function Logo() {
  const { theme } = useTheme()

  const renderSegment = ([sgr, text]: [string, string]): JSX.Element => {
    const [, fgKey, bgKey] = sgr.split(";")
    const fgRaw = FGS[fgKey] ?? [255, 255, 255]
    const fg = RGBA.fromInts(fgRaw[0], fgRaw[1], fgRaw[2], 255)
    const bgRaw = BGS[bgKey]
    const bg = bgRaw ? RGBA.fromInts(bgRaw[0], bgRaw[1], bgRaw[2], 255) : undefined
    return (
      <text fg={fg} bg={bg} selectable={false}>
        {text}
      </text>
    )
  }

  return (
    <box>
      <For each={artSegments}>
        {(segs) => (
          <box flexDirection="row">
            <For each={segs}>{renderSegment}</For>
          </box>
        )}
      </For>
    </box>
  )
}
