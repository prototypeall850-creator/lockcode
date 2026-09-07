import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (semver.lt(semver.coerce(process.versions.bun) ?? "0.0.0", semver.coerce(expectedBunVersionRange) ?? "0.0.0")) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  LOCKCODE_CHANNEL: process.env["LOCKCODE_CHANNEL"],
  LOCKCODE_BUMP: process.env["LOCKCODE_BUMP"],
  LOCKCODE_VERSION: process.env["LOCKCODE_VERSION"],
  LOCKCODE_RELEASE: process.env["LOCKCODE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.LOCKCODE_CHANNEL) return env.LOCKCODE_CHANNEL
  if (env.LOCKCODE_BUMP) return "latest"
  if (env.LOCKCODE_VERSION && !env.LOCKCODE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.LOCKCODE_VERSION) return env.LOCKCODE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await fetch("https://registry.npmjs.org/lockcode-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.LOCKCODE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const bot = ["actions-user", "lockcode", "lockcode-agent[bot]"]
const teamPath = path.resolve(import.meta.dir, "../../../.github/TEAM_MEMBERS")
const team = [
  ...(await Bun.file(teamPath)
    .text()
    .then((x) => x.split(/\r?\n/).map((x) => x.trim()))
    .then((x) => x.filter((x) => x && !x.startsWith("#")))),
  ...bot,
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.LOCKCODE_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`lockcode script`, JSON.stringify(Script, null, 2))
