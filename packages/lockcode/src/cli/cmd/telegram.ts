import type { Argv } from "yargs"
import * as fs from "fs/promises"
import * as fsSync from "fs"
import * as os from "os"
import * as path from "path"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Process } from "@/util/process"

const BOT_URL = "https://raw.githubusercontent.com/prototypeall850-creator/lockcode/main/telegram/bot.mjs"
const INSTALL_DIR = path.join(os.homedir(), "lockcode-tele")

interface TelegramArgs {
  token?: string
  admin?: string
  skipService?: boolean
  update?: boolean
}

function isTermux() {
  return process.env.TERMUX_VERSION !== undefined || fsSync.existsSync("/data/data/com.termux/files/usr")
}

function prefix() {
  return process.env.PREFIX || "/data/data/com.termux/files/usr"
}

async function has(cmd: string) {
  const r = await Process.run(["sh", "-c", `command -v ${cmd}`], { nothrow: true })
  return r.code === 0
}

async function pkgInstall(...pkgs: string[]) {
  const s = prompts.spinner()
  s.start(`pkg install ${pkgs.join(" ")}`)
  const r = await Process.run(["pkg", "install", "-y", ...pkgs], { stdout: "pipe", stderr: "pipe", nothrow: true })
  if (r.code === 0) s.stop("paket terpasang")
  else s.stop(`pkg gagal (code ${r.code}): ${r.stderr.toString().trim().slice(0, 200)}`)
  return r.code === 0
}

export const TelegramCommand = {
  command: "telegram",
  describe: "setup bot Telegram di atas lockcode (Termux: service + autostart)",
  builder: (yargs: Argv) =>
    yargs
      .option("token", { type: "string", describe: "TELE_TOKEN dari @BotFather" })
      .option("admin", { type: "string", describe: "TELE_ADMIN_ID (user ID lu)" })
      .option("skip-service", { type: "boolean", describe: "jangan pasang service (jalankan manual)", default: false })
      .option("update", { type: "boolean", describe: "download ulang bot.mjs terbaru", default: false }),

  handler: async (args: TelegramArgs) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("LockCode Telegram Bot")

    const termux = isTermux()

    if (!termux && !args.skipService) {
      prompts.log.warning("Bukan Termux — setup service dilewati, cuma download bot + tulis .env")
    }

    // 1. node
    if (!(await has("node"))) {
      if (!termux) {
        prompts.log.error("Node.js gak ada. Install dulu: https://nodejs.org (minimal v18)")
        process.exit(1)
      }
      prompts.log.info("Node.js gak ada, install via pkg…")
      if (!(await pkgInstall("nodejs"))) {
        prompts.log.error("Gagal install nodejs — jalankan manual: pkg install nodejs")
        process.exit(1)
      }
    }

    // 2. folder + bot.mjs
    await fs.mkdir(INSTALL_DIR, { recursive: true })
    const botPath = path.join(INSTALL_DIR, "bot.mjs")
    const needDownload = args.update || !fsSync.existsSync(botPath)
    if (needDownload) {
      const s = prompts.spinner()
      s.start("download bot.mjs")
      const r = await Process.run(
        ["curl", "-fsSL", BOT_URL, "-o", botPath],
        { stdout: "pipe", stderr: "pipe", nothrow: true },
      )
      if (r.code !== 0) {
        s.stop("download gagal")
        prompts.log.error(`curl error: ${r.stderr.toString().trim().slice(0, 200)}`)
        process.exit(1)
      }
      s.stop("bot.mjs terbaru tersimpan")
    } else {
      prompts.log.step("bot.mjs sudah ada (pakai --update buat versi baru)")
    }

    // 3. kredensial
    let token = args.token
    let admin = args.admin
    if (!token) {
      const v = await prompts.text({
        message: "TELE_TOKEN (dari @BotFather)",
        validate: (v: string) => (v.includes(":") && v.length > 20 ? undefined : "Token bot gak valid"),
      })
      if (prompts.isCancel(v)) process.exit(0)
      token = v.trim()
    }
    if (!admin) {
      const v = await prompts.text({
        message: "TELE_ADMIN_ID (user ID lu, cek @userinfobot)",
        validate: (v: string) => (/^\d+$/.test(v) ? undefined : "Harus angka"),
      })
      if (prompts.isCancel(v)) process.exit(0)
      admin = v.trim()
    }

    await fs.writeFile(
      path.join(INSTALL_DIR, ".env"),
      `TELE_TOKEN=${token}\nTELE_ADMIN_ID=${admin}\n`,
      { mode: 0o600 },
    )
    prompts.log.step(".env tersimpan di " + INSTALL_DIR)

    // 4. service (Termux saja)
    if (termux && !args.skipService) {
      const serviceDir = path.join(prefix(), "var", "service", "lockcode-tele")
      await fs.mkdir(serviceDir, { recursive: true })
      const runScript = [
        "#!/data/data/com.termux/files/usr/bin/sh",
        "set -a",
        `. ${INSTALL_DIR}/.env`,
        "set +a",
        `exec termux-wake-lock node ${botPath} >> ${INSTALL_DIR}/bot.log 2>&1`,
        "",
      ].join("\n")
      await fs.writeFile(path.join(serviceDir, "run"), runScript, { mode: 0o755 })

      if (!(await has("sv"))) {
        prompts.log.info("termux-services gak ada, install…")
        if (!await pkgInstall("termux-services")) {
          prompts.log.warning("service gak terpasang. Jalankan manual: node " + botPath)
          prompts.outro("Setup selesai (tanpa service)")
          return
        }
      }
      const up = await Process.run(["sv", "up", "lockcode-tele"], { stdout: "pipe", stderr: "pipe", nothrow: true })
      if (up.code === 0) {
        prompts.log.success("service jalan — bot hidup dan auto-restart")
      } else {
        prompts.log.warning(
          "sv up gagal: " + up.stderr.toString().trim().slice(0, 120) + " — coba manual: sv up lockcode-tele",
        )
      }
      prompts.log.message(`Log: ~/lockcode-tele/bot.log · matikan: sv down lockcode-tele`)
    } else {
      prompts.log.message(`Jalankan manual:\n  set -a; source ${INSTALL_DIR}/.env; set +a\n  node ${botPath}`)
    }

    prompts.outro("Selesai! Cek Telegram lu, kirim /status ke bot.")
  },
}
