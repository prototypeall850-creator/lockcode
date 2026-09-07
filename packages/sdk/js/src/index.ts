export * from "./client.js"
export * from "./server.js"

import { createLockcodeClient } from "./client.js"
import { createLockcodeServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createLockcode(options?: ServerOptions) {
  const server = await createLockcodeServer({
    ...options,
  })

  const client = createLockcodeClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
