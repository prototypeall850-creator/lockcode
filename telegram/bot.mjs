#!/usr/bin/env node
// lockcode Telegram bot — nol dependency (Node 18+, built-in fetch).
// Tiap pesan → spawn `lockcode run --format json` (session per chat) → balas hasil.
// Model default: provider free bawaan (tanpa -m). Admin bisa ganti via /model.

import { spawn } from "node:child_process"
import net from "node:net"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = join(HERE, "state.json")

const TELE_TOKEN = process.env.TELE_TOKEN
const ADMIN_ID = process.env.TELE_ADMIN_ID // angka, wajib
const ALLOWED = new Set(
  [ADMIN_ID, ...(process.env.TELE_ALLOWED_IDS || "").split(",")]
    .filter(Boolean)
    .map((s) => String(s).trim()),
)
const LOCKCODE_BIN = process.env.LOCKCODE_BIN || "lockcode"
const LOCKCODE_CWD = process.env.LOCKCODE_CWD || process.cwd()
const TIMEOUT_MS = Number(process.env.LOCKCODE_TELE_TIMEOUT || 300) * 1000
const AUTO = ["1", "yes", "true"].includes((process.env.LOCKCODE_TELE_AUTO || "").toLowerCase())
const ROUTER_URL = process.env.LOCKCODE_ROUTER_URL || "http://127.0.0.1:20128"

// ---------- state ----------
let state = { model: null, sessions: {} } // model: null = default (zen free)
try {
  if (existsSync(STATE_FILE)) state = { ...state, ...JSON.parse(readFileSync(STATE_FILE, "utf8")) }
} catch {}
const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

// ---------- telegram api ----------
const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${TELE_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }).then((r) => r.json())

async function send(chatID, text) {
  const clean = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trim() || "(kosong)"
  for (let i = 0; i < clean.length; i += 4000) {
    await api("sendMessage", { chat_id: chatID, text: clean.slice(i, i + 4000) }).catch(() => {})
  }
}

const typing = (chatID) => api("sendChatAction", { chat_id: chatID, action: "typing" }).catch(() => {})

// ---------- lockcode runner ----------
function portUp(host, port) {
  return new Promise((resolve) => {
    const s = net.connect(port, host)
    s.once("connect", () => (s.destroy(), resolve(true)))
    s.once("error", () => resolve(false))
    s.setTimeout(1500, () => (s.destroy(), resolve(false)))
  })
}

async function routerAlive() {
  try {
    const u = new URL(ROUTER_URL)
    return await portUp(u.hostname, Number(u.port) || 20128)
  } catch {
    return false
  }
}

// spawn satu run; resolve { text, tools, sessionID, error }
function runLockcode({ message, sessionID, model }) {
  return new Promise((resolve) => {
    const args = ["run", "--format", "json"]
    if (sessionID) args.push("-s", sessionID)
    if (model) args.push("-m", model)
    if (AUTO) args.push("--auto")
    args.push(message)

    const child = spawn(LOCKCODE_BIN, args, { cwd: LOCKCODE_CWD, env: process.env, stdio: ["ignore", "pipe", "pipe"] })
    let out = "",
      err = "",
      done = false
    const timer = setTimeout(() => {
      if (!done) {
        child.kill("SIGKILL")
        err = "timeout: model gak selesai dalam " + TIMEOUT_MS / 1000 + "s"
      }
    }, TIMEOUT_MS)
    const finish = (r) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(r)
    }

    child.stdout.on("data", (d) => (out += d))
    child.stderr.on("data", (d) => (err += d))
    child.on("error", (e) => finish({ text: "", tools: [], error: "gagal spawn " + LOCKCODE_BIN + ": " + e.message }))
    child.on("close", () => {
      const texts = [],
        tools = [],
        errors = []
      let got = null
      for (const line of out.split("\n")) {
        if (!line.trim()) continue
        let ev
        try {
          ev = JSON.parse(line)
        } catch {
          continue
        }
        got = ev
        if (ev.type === "text" && ev.part?.text) texts.push(ev.part.text.trim())
        else if (ev.type === "tool_use" && ev.part?.tool) tools.push(ev.part.tool)
        else if (ev.type === "error") {
          const e = ev.error
          errors.push(e?.data?.message || e?.message || String(e?.name || e))
        }
      }
      finish({
        text: texts.join("\n\n"),
        tools,
        sessionID: got?.sessionID || null,
        notFound: /session not found/i.test(out + err),
        error: errors.join("\n") || (texts.length ? "" : (out + err).replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trim()),
      })
    })
  })
}

async function ask(chatID, message) {
  const sess = state.sessions[chatID]
  const model = state.model
  if (model?.startsWith("9router/") && !(await routerAlive())) {
    return "9router belum jalan (port 20128 mati). Buka dulu di termux, atau /model default."
  }
  let r = await runLockcode({ message, sessionID: sess, model })
  if (r.notFound) {
    delete state.sessions[chatID]
    save()
    r = await runLockcode({ message, model })
  }
  if (r.sessionID && r.sessionID !== sess) {
    state.sessions[chatID] = r.sessionID
    save()
  }
  const parts = []
  if (r.text) parts.push(r.text)
  if (r.error) parts.push("⚠️ " + r.error)
  if (!parts.length) parts.push("(gak ada jawaban)")
  if (r.tools.length) {
    const count = {}
    for (const t of r.tools) count[t] = (count[t] || 0) + 1
    parts.push("_(" + Object.entries(count).map(([t, n]) => `${t}×${n}`).join(", ") + ")_")
  }
  return parts.join("\n\n")
}

// ---------- perintah admin ----------
async function handleCommand(chatID, fromID, text) {
  const [cmd, ...rest] = text.trim().split(/\s+/)
  const arg = rest.join(" ")

  if (cmd === "/model") {
    if (String(fromID) !== String(ADMIN_ID)) return "Perintah ini buat admin aja."
    if (!arg) {
      return state.model
        ? `Model aktif: ${state.model}\nPilihan:\n• /model default — free bawaan\n• /model 9router/<model> — pakai 9router (harus jalan dulu)`
        : "Model aktif: default (free bawaan)\nPakai: /model 9router/<model> atau /model default"
    }
    if (arg === "default" || arg === "reset") {
      state.model = null
      save()
      return "OK, balik ke model default (free bawaan)."
    }
    if (!arg.includes("/")) return "Format: /model <provider>/<model> — contoh: /model 9router/kr/claude-sonnet-4.5"
    if (arg.startsWith("9router/") && !(await routerAlive())) {
      return "9router belum jalan (port 20128 mati). Buka dulu, baru ulangi perintah ini."
    }
    state.model = arg
    save()
    return `OK, model sekarang: ${arg}`
  }

  if (cmd === "/new") {
    delete state.sessions[chatID]
    save()
    return "Sesi baru siap. Konteks chat ini di-reset."
  }

  if (cmd === "/status") {
    return [
      `Model: ${state.model || "default (free bawaan)"}`,
      `Sesi chat ini: ${state.sessions[chatID] || "-"}`,
      `9router: ${(await routerAlive()) ? "jalan" : "mati"}`,
      `Auto-approve tools: ${AUTO ? "ON" : "OFF"}`,
    ].join("\n")
  }

  return null
}

// ---------- long polling ----------
async function loop(offset = 0) {
  while (true) {
    let res
    try {
      res = await api("getUpdates", { offset, timeout: 30 })
    } catch {
      await new Promise((r) => setTimeout(r, 3000))
      continue
    }
    if (!res.ok) {
      console.error("telegram:", res.description)
      await new Promise((r) => setTimeout(r, 5000))
      continue
    }
    for (const up of res.result) {
      offset = up.update_id + 1
      const msg = up.message
      if (!msg?.text || msg.text.startsWith("/")) {
        if (msg?.text && ALLOWED.has(String(msg.from?.id))) {
          const r = await handleCommand(msg.chat.id, msg.from.id, msg.text)
          if (r) await send(msg.chat.id, r)
        }
        continue
      }
      if (!ALLOWED.has(String(msg.from?.id))) continue // gak dikenal → diabaikan

      typing(msg.chat.id)
      const keepAlive = setInterval(() => typing(msg.chat.id), 5000)
      let reply
      try {
        reply = await ask(msg.chat.id, msg.text)
      } catch (e) {
        reply = "⚠️ " + (e?.message || e)
      } finally {
        clearInterval(keepAlive)
      }
      await send(msg.chat.id, reply)
    }
  }
}

// ---------- selftest: jalankan satu prompt tanpa telegram ----------
if (process.argv[2] === "--selftest") {
  const prompt = process.argv[3] || "balas singkat: siapa kamu"
  console.log(`> spawn ${LOCKCODE_BIN} (model: ${state.model || "default"})`)
  const r = await runLockcode({ message: prompt, sessionID: null, model: state.model })
  console.log("sessionID:", r.sessionID)
  console.log("tools:", r.tools.join(",") || "-")
  console.log("--- jawaban ---")
  console.log(r.text || r.error || "(kosong)")
  process.exit(0)
}

if (!TELE_TOKEN || !ADMIN_ID) {
  console.error("Set env TELE_TOKEN (dari @BotFather) dan TELE_ADMIN_ID (user ID lu).")
  process.exit(1)
}

console.log(`lockcode-tele jalan. admin=${ADMIN_ID} model=${state.model || "default"} auto=${AUTO}`)
loop()
