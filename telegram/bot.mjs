#!/usr/bin/env node
// lockcode Telegram bot — nol dependency (Node 18+, built-in fetch).
// Mode agent : spawn `lockcode run --format json` (session per chat, full tools/skills).
// Mode chat  : langsung ke API Zen (https://opencode.ai/zen/v1, token dari auth.json) — cepat, chat doang.
// Balasan diformat HTML (code block, inline code, bold, tabel rata kolom).

import { spawn, spawnSync } from "node:child_process"
import net from "node:net"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const STATE_FILE = join(HERE, "state.json")
const HOME = homedir()

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
const ZEN_API = "https://opencode.ai/zen/v1"

const CHAT_SYSTEM =
  "Kamu lockcode, AI asisten yang berjalan di Telegram. " +
  "Jawab ringkas, jelas, dan berguna. Kode selalu dalam markdown code block dengan bahasa yang sesuai. " +
  "Tabel dalam format markdown table. Jangan menyebut model atau provider internal."

// ---------- state ----------
// model: null = default (zen free). mode: "agent" | "chat".
// sessions: { [chatID]: agentSessionID }, history: { [chatID]: [{role, content}] }
let state = { model: null, mode: "agent", sessions: {}, history: {} }
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

const typing = (chatID) => api("sendChatAction", { chat_id: chatID, action: "typing" }).catch(() => {})

// ---------- format markdown → telegram HTML ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// tabel markdown → teks rata kolom di <pre> (telegram gak render tabel asli)
function tables(p) {
  const lines = p.split("\n")
  const out = []
  let i = 0
  while (i < lines.length) {
    const next = lines[i + 1] || ""
    if (lines[i].includes("|") && /^\s*\|?[\s:|-]*-[\s:|-]*\|?[\s:|-]*$/.test(next) && next.includes("-")) {
      const rows = [lines[i]]
      let j = i + 2
      while (j < lines.length && lines[j].includes("|")) rows.push(lines[j++])
      const cells = rows.map((r) =>
        r
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim()),
      )
      const body = cells.filter((c, idx) => idx !== 1 || !c.every((s) => /^:?-+:?$/.test(s) || s === ""))
      const widths = []
      for (const c of body) c.forEach((s, w) => (widths[w] = Math.max(widths[w] || 0, s.length)))
      out.push("<pre>" + body.map((c) => c.map((s, w) => s.padEnd(widths[w])).join("  ")).join("\n") + "</pre>")
      i = j
      continue
    }
    out.push(lines[i++])
  }
  return out.join("\n")
}

function inline(p) {
  p = esc(p)
  p = tables(p)
  p = p.replace(/`([^`\n]+)`/g, "<code>$1</code>")
  p = p.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  p = p.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
  p = p.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<i>$2</i>")
  p = p.replace(/^#{1,4}\s+(.+)$/gm, "<b>$1</b>")
  return p
}

function mdToHTML(md) {
  // code fence dipisah dulu — kontennya jadi <pre>, sisanya di-format inline
  return md
    .split(/(```[\s\S]*?(?:```|$))/g)
    .map((p) => {
      if (p.startsWith("```")) {
        const m = /^```(\w*)\n?([\s\S]*?)\n?```$/.exec(p)
        const code = m ? m[2] : p.replace(/^```\w*\n?/, "").replace(/```$/, "")
        return "<pre><code>" + esc(code) + "</code></pre>"
      }
      return inline(p)
    })
    .join("")
}

async function send(chatID, text) {
  const clean = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trim() || "(kosong)"
  const html = mdToHTML(clean)
  for (let i = 0; i < html.length; i += 3800) {
    const chunk = html.slice(i, i + 3800)
    const r = await api("sendMessage", {
      chat_id: chatID,
      text: chunk,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    })
    if (!r.ok) await api("sendMessage", { chat_id: chatID, text: esc(clean.slice(i, i + 4000)) }).catch(() => {})
  }
}

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

// ---------- mode chat: direct ke API zen / 9router ----------
let _ver = ""
function lockcodeVersion() {
  if (!_ver) {
    try {
      _ver = spawnSync(LOCKCODE_BIN, ["--version"], { timeout: 8000 }).stdout.toString().trim()
    } catch {}
    if (!/^[\w.-]+$/.test(_ver)) _ver = "0.1.0"
  }
  return _ver
}

// token zen dari auth.json lockcode (~/.local/share/lockcode/auth.json)
function zenToken() {
  const xdg = process.env.XDG_DATA_HOME || join(HOME, ".local", "share")
  try {
    const auth = JSON.parse(readFileSync(join(xdg, "lockcode", "auth.json"), "utf8"))
    const oc = auth.opencode
    if (oc?.type === "oauth") return oc.access
    if (oc?.type === "api") return oc.key
  } catch {}
  return null
}

// default model agent = recent (model.json) → first sorted model free opencode
function defaultChatModel() {
  const xdgState = process.env.XDG_STATE_HOME || join(HOME, ".local", "state")
  try {
    const rec = JSON.parse(readFileSync(join(xdgState, "lockcode", "model.json"), "utf8"))
    if (Array.isArray(rec.recent) && rec.recent[0]?.modelID) return rec.recent[0].modelID
  } catch {}
  const xdgCache = process.env.XDG_CACHE_HOME || join(HOME, ".cache")
  try {
    const cat = JSON.parse(readFileSync(join(xdgCache, "lockcode", "models.json"), "utf8"))
    const ms = cat.opencode?.models || {}
    const free = Object.entries(ms)
      .filter(([, m]) => m?.cost?.input === 0)
      .map(([n]) => n)
      .sort()
    if (free[0]) return free[0]
    return Object.keys(ms).sort()[0]
  } catch {}
  return "grok-code"
}

const rnd = (n) => Math.random().toString(16).slice(2).padEnd(n, "0").slice(0, n)

async function chatMode(chatID, message) {
  let url, headers, modelID
  const model = state.model
  if (model?.startsWith("9router/")) {
    if (!(await routerAlive())) return "9router belum jalan (port 20128 mati). Buka dulu di termux, atau /model default."
    url = ROUTER_URL.replace(/\/$/, "") + "/v1/chat/completions"
    headers = { "content-type": "application/json" }
    modelID = model.slice("9router/".length)
  } else {
    const tok = zenToken()
    if (!tok) return "Auth Zen gak ketemu. Jalankan `lockcode auth login` dulu, atau /mode agent."
    url = ZEN_API + "/chat/completions"
    headers = {
      "content-type": "application/json",
      authorization: "Bearer " + tok,
      "user-agent": "opencode/" + lockcodeVersion(),
      "x-opencode-client": "cli",
      "x-opencode-session": state.sessions[chatID] || "ses_" + rnd(16),
      "x-opencode-request": "req_" + rnd(16),
    }
    modelID = model?.startsWith("zen/") ? model.slice(4) : model || defaultChatModel()
  }

  const hist = state.history[chatID] || []
  const messages = [{ role: "system", content: CHAT_SYSTEM }, ...hist.slice(-16), { role: "user", content: message }]

  let data
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: modelID, messages }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return "⚠️ API error " + res.status + ": " + (await res.text()).slice(0, 200)
    data = await res.json()
  } catch (e) {
    return "⚠️ " + (e?.message || e)
  }
  const reply = data?.choices?.[0]?.message?.content
  if (typeof reply !== "string" || !reply.trim()) return "⚠️ jawaban kosong dari API."

  hist.push({ role: "user", content: message })
  hist.push({ role: "assistant", content: reply })
  state.history[chatID] = hist.slice(-32)
  save()
  return reply
}

// ---------- pertanyaan soal bot → jawaban fix, gak ke AI ----------
const META_RES = [
  /\b(siapa|kenalan)\b[^\n]{0,20}\b(kamu|lu|lo|you|bot)\b/i,
  /\b(kamu|lu|lo|you|bot)\b[^\n]{0,20}\bsiapa\b/i,
  /\b(model|llm)\s*(apa|apa sih|what|yang mana)\b/i,
  /\b(pakai|pake|make|using|pakello)\b[^\n]{0,12}\b(model|llm|ai)\b/i,
  /\bwhat\s+(model|ai|bot)\b/i,
  /\b(chat|ngobrol|obrolan)\b[^\n]{0,20}\b(dimana|di ?mana|where)\b/i,
  /\bwhere\b[^\n]{0,20}\b(chat|talking)\b/i,
  /\b(kamu|bot)\b[^\n]{0,15}\b(di ?mana|dimana)\b/i,
]
const isMeta = (t) => t.length < 100 && META_RES.some((r) => r.test(t))
const META_ANSWER = "lockcode - AI asistent"

// ---------- perintah ----------
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

  if (cmd === "/mode") {
    if (String(fromID) !== String(ADMIN_ID)) return "Perintah ini buat admin aja."
    if (!arg) {
      return [
        `Mode aktif: ${state.mode === "chat" ? "chat" : "agent"}`,
        "/mode agent — full lockcode: tools, skills, file, bash",
        "/mode chat — cepat, jawab langsung dari API (chat doang)",
      ].join("\n")
    }
    if (arg === "chat") {
      state.mode = "chat"
      save()
      return "Mode chat: jawaban langsung dari API Zen — cepat, tanpa tools/skills."
    }
    if (arg === "agent") {
      state.mode = "agent"
      save()
      return "Mode agent: full lockcode — tools, skills, file, bash."
    }
    return "Pilihan: /mode agent atau /mode chat"
  }

  if (cmd === "/new") {
    delete state.sessions[chatID]
    delete state.history[chatID]
    save()
    return "Sesi baru siap. Konteks chat ini di-reset."
  }

  if (cmd === "/help") {
    return [
      "Chat biasa — langsung nanya aja.",
      "",
      "/new — reset konteks chat ini",
      "/mode — lihat/ganti mode (agent / chat)",
      "/model — ganti model (admin)",
      "/status — info bot",
    ].join("\n")
  }

  if (cmd === "/status") {
    return [
      `Mode: ${state.mode === "chat" ? "chat" : "agent"}`,
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

      // pertanyaan soal bot → jawaban fix, gak panggil AI
      if (isMeta(msg.text)) {
        await send(msg.chat.id, META_ANSWER)
        continue
      }

      typing(msg.chat.id)
      const keepAlive = setInterval(() => typing(msg.chat.id), 5000)
      let reply
      try {
        reply = state.mode === "chat" ? await chatMode(msg.chat.id, msg.text) : await ask(msg.chat.id, msg.text)
      } catch (e) {
        reply = "⚠️ " + (e?.message || e)
      } finally {
        clearInterval(keepAlive)
      }
      await send(msg.chat.id, reply)
    }
  }
}

// ---------- menu slash command di UI telegram ----------
async function setMenu() {
  try {
    await api("setMyCommands", {
      commands: [
        { command: "new", description: "chat baru (reset konteks)" },
        { command: "mode", description: "ganti mode: agent / chat" },
        { command: "model", description: "ganti model (admin)" },
        { command: "status", description: "info bot" },
        { command: "help", description: "cara pakai" },
      ],
    })
  } catch {}
}

// ---------- selftest ----------
if (process.argv[2] === "--selftest" || process.argv[2] === "--selftest-chat") {
  const chat = process.argv[2] === "--selftest-chat"
  const prompt = process.argv[3] || (chat ? "balas singkat: 1+1" : "balas singkat: siapa kamu")
  if (chat) {
    console.log(`> mode chat (model: ${state.model || "default"})`)
    console.log(await chatMode("selftest", prompt))
  } else {
    console.log(`> spawn ${LOCKCODE_BIN} (model: ${state.model || "default"})`)
    const r = await runLockcode({ message: prompt, sessionID: null, model: state.model })
    console.log("sessionID:", r.sessionID)
    console.log("tools:", r.tools.join(",") || "-")
    console.log("--- jawaban ---")
    console.log(r.text || r.error || "(kosong)")
  }
  process.exit(0)
}

if (!TELE_TOKEN || !ADMIN_ID) {
  console.error("Set env TELE_TOKEN (dari @BotFather) dan TELE_ADMIN_ID (user ID lu).")
  process.exit(1)
}

console.log(`lockcode-tele jalan. admin=${ADMIN_ID} mode=${state.mode} model=${state.model || "default"} auto=${AUTO}`)
await setMenu()
loop()
