# lockcode

**lockcode** — binary tunggal `linux-arm64`
**native di Termux (Android, aarch64)** lewat glibc bridge, tanpa proot, tanpa root.

## Install di HP (Termux) — satu command

```bash
curl -fsSL https://raw.githubusercontent.com/prototypeall850-creator/lockcode/main/install.sh | bash
```

Installer otomatis: pasang repo glibc + glibc-runner, download binary **terbaru**
dari GitHub Releases, bikin wrapper. Pin versi tertentu:
`curl ... | bash -s v0.1.7`

## Bot Telegram (asisten AI di atas lockcode)

Bot jalan pakai model, skills, plugin, dan tools lockcode — jadi pintar. Di HP:

```bash
lockcode telegram
```

Command interaktif: install nodejs (kalau belum), download bot, tanya `TELE_TOKEN`
+ `TELE_ADMIN_ID`, pasang service termux (auto-restart + jalan saat boot).
Model free bawaan jalan langsung; mau model 9router: buka 9router dulu,
lalu di bot `/model 9router/<model>` (admin only). Detail: [telegram/README.md](telegram/README.md).

## Pakai

```bash
lockcode                 # TUI interaktif
lockcode auth login      # login gateway (device flow)
lockcode run "hai"       # non-interaktif
lockcode models          # list model
```

## Rebuild dari source

```bash
bun install
cd packages/lockcode
LOCKCODE_CHANNEL=latest LOCKCODE_VERSION=0.1.7 bun run script/build.ts --skip-install
# output: dist/lockcode-linux-arm64/bin/lockcode
# kecilin: # (opsional) upx --best --lzma — GAK DISARANKAN: UPX binary gak jalan di Android Termux
```
