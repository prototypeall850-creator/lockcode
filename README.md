# lockcode

**lockcode** — binary tunggal `linux-arm64`
**native di Termux (Android, aarch64)** lewat glibc bridge, tanpa proot, tanpa root.

## Install di HP (Termux) — satu command

```bash
curl -fsSL https://raw.githubusercontent.com/prototypeall850-creator/lockcode/main/install.sh | bash
```

Installer otomatis: pasang repo glibc + glibc-runner, download binary **terbaru**
dari GitHub Releases, bikin wrapper. Pin versi tertentu:
`curl ... | bash -s v0.1.5`

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
LOCKCODE_CHANNEL=latest LOCKCODE_VERSION=0.1.5 bun run script/build.ts --skip-install
# output: dist/lockcode-linux-arm64/bin/lockcode
# kecilin: # (opsional) upx --best --lzma — GAK DISARANKAN: UPX binary gak jalan di Android Termux
```
