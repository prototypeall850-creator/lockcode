# lockcode Telegram Bot

Bot Telegram yang jalan di atas lockcode — pakai model, skills, plugin, dan tools lockcode. Nol dependency (Node 18+ bawaan `fetch`).

```
Pesan Telegram → bot (polling, ringan) → lockcode run (session per chat) → jawaban
```

## Setup di HP (Termux)

```bash
pkg install -y nodejs termux-services
mkdir -p ~/lockcode-tele && cd ~/lockcode-tele
curl -fsSLO https://raw.githubusercontent.com/prototypeall850-creator/lockcode/main/telegram/bot.mjs
```

Ambil token bot dari [@BotFather](https://t.me/BotFather), dan user ID lu dari [@userinfobot](https://t.me/userinfobot).

```bash
export TELE_TOKEN="123456:ABC-DEF..."   # token bot
export TELE_ADMIN_ID="123456789"        # user ID lu (admin)
node bot.mjs
```

Default model = model free bawaan. Yang bukan admin cuma bisa chat (juga bisa dibatasi — lihat env di bawah).

## Perintah bot

| Perintah | Siapa | Fungsi |
|---|---|---|
| `/model` | admin | lihat model aktif |
| `/model 9router/<model>` | admin | ganti ke model 9router (cek dulu port 20128 hidup) |
| `/model default` | admin | balik ke model free bawaan |
| `/new` | semua | reset konteks chat ini (sesi baru) |
| `/status` | semua | status model, sesi, 9router |

## Pakai model 9router (opsional)

1. Jalanin 9router di termux (`9router`) — endpoint `127.0.0.1:20128` aktif
2. Daftarin provider di `~/.config/lockcode/lockcode.json`:

```json
{
  "provider": {
    "9router": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "9Router (local)",
      "options": { "baseURL": "http://127.0.0.1:20128/v1", "apiKey": "KEY_9ROUTER" },
      "models": {
        "kr/claude-sonnet-4.5": { "name": "Claude Sonnet 4.5 (Kiro Free)" }
      }
    }
  }
}
```

3. Di bot: `/model 9router/kr/claude-sonnet-4.5`

Kalau 9router mati, bot bilang "belum jalan" — model gak ganti. Tutup 9router → `/model default`.

## Env

| Var | Default | Fungsi |
|---|---|---|
| `TELE_TOKEN` | wajib | token bot dari @BotFather |
| `TELE_ADMIN_ID` | wajib | user ID admin (ganti model) |
| `TELE_ALLOWED_IDS` | admin saja | user ID lain yang boleh chat (pisah koma) |
| `LOCKCODE_BIN` | `lockcode` | path binary/wrapper lockcode |
| `LOCKCODE_CWD` | folder bot | direktori kerja lockcode |
| `LOCKCODE_TELE_TIMEOUT` | `300` | batas jawaban per pesan (detik) |
| `LOCKCODE_TELE_AUTO` | off | `1` = auto-approve permission tools (`--auto`) |
| `LOCKCODE_ROUTER_URL` | `http://127.0.0.1:20128` | endpoint 9router untuk health check |

## Jalan terus di background

```bash
pkg install -y termux-services
mkdir -p $PREFIX/var/service/lockcode-tele
cat > $PREFIX/var/service/lockcode-tele/run <<'RUN'
#!/data/data/com.termux/files/usr/bin/sh
export TELE_TOKEN="ISI_TOKEN"
export TELE_ADMIN_ID="ISI_ID"
exec termux-wake-lock node /data/data/com.termux/files/home/lockcode-tele/bot.mjs
RUN
chmod +x $PREFIX/var/service/lockcode-tele/run
sv up lockcode-tele
```

Bot auto-restart kalau crash, jalan lagi saat HP boot (termux-services + Termux:Boot).
