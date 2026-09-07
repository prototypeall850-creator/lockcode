declare global {
  const LOCKCODE_VERSION: string
  const LOCKCODE_CHANNEL: string
}

export const InstallationVersion = typeof LOCKCODE_VERSION === "string" ? LOCKCODE_VERSION : "local"
export const InstallationChannel = typeof LOCKCODE_CHANNEL === "string" ? LOCKCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
