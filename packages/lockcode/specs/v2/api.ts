// @ts-nocheck

import { LockCode } from "@lockcode-ai/core"
import { ReadTool } from "@lockcode-ai/core/tools"

const lockcode = LockCode.make({})

lockcode.tool.add(ReadTool)

lockcode.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

lockcode.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

lockcode.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await lockcode.session.create({
  agent: "build",
})

lockcode.subscribe((event) => {
  console.log(event)
})

await lockcode.session.prompt({
  sessionID,
  text: "hey what is up",
})

await lockcode.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await lockcode.session.wait()

console.log(await lockcode.session.messages(sessionID))
