# lockcode

Port opencode 1.18.29 → **lockcode**, binary tunggal `linux-arm64` (Bun compile),
jalan **native di Termux** lewat glibc bridge (glibc-runner) — tanpa proot, tanpa root.
Semua brand dirubah jadi lockcode. Kontrak eksternal (gateway/auth) tetap hidup.

## Isi folder

| File | Fungsi |
|---|---|
| `lockcode-arm64` | binary utama (aarch64, glibc) |
| `install.sh` | installer Termux |

## Install di HP (Termux)

```bash
pkg install -y git   # transfer file ini dulu ke storage HP, mis: ~/lockcode/
cd ~/lockcode
bash install.sh
```

Install script otomatis: nambah repo `termux-glibc`, install `glibc` + `glibc-runner`,
pasang binary ke `$PREFIX/glibc/opt/lockcode/bin/`, bikin wrapper `$PREFIX/bin/lockcode`.

## Pakai

```bash
lockcode                 # TUI interaktif (mirip opencode asli)
lockcode auth login      # login gateway opencode.ai (device flow — kontrak server asli)
lockcode run "hai"       # non-interaktif
lockcode models          # list model
lockcode serve           # headless server
```

API key (salah satu):
- `lockcode auth login` → login console opencode.ai
- env `OPENCODE_API_KEY=...` (nama env dari catalog gateway, ikut kontrak upstream)

## Data dirs

```
~/.local/share/lockcode    # db, auth.json, log
~/.config/lockcode         # config (lockcode.json)
~/.cache/lockcode          # models.json, bin/rg (ripgrep auto-download)
<project>/.lockcode/       # project config/agents/commands
```

## Yang diubah dari opencode asli

- Rename total: `opencode→lockcode`, `OpenCode→LockCode`, `OPENCODE_→LOCKCODE_`,
  scope `@opencode-ai/→@lockcode-ai/`, folder/file/config `.opencode→.lockcode`
- Command `upgrade` dihapus (biar gak balikin ke opencode asli)
- Web UI embed di-skip (fallback non-interaktif = `lockcode run`)

## Yang SENGAJA tidak diubah (kontrak eksternal — jangan direname)

- `https://opencode.ai/console|auth|go|docs|config.json` — auth + docs + schema
- `https://models.opencode.ai` + api `https://opencode.ai/zen/v1` — gateway
- OAuth client id `opencode-cli` — terdaftar di server console
- `originator: "opencode"` — flow OAuth OpenAI (Codex)
- npm `@opencode-ai/plugin` — runtime package user-plugin (diinstall per-project)
- env `OPENCODE_API_KEY` — nama env dari catalog gateway

## Catatan teknis Termux

- Wrapper jalankan via `ld-linux-aarch64.so.1 --library-path` langsung (scoped),
  BUKAN export `LD_LIBRARY_PATH` global (bisa meracuni proses bionic child) —
  pelajaran dari claude-code-native-termux.
- `LD_PRELOAD` di-unset di wrapper (preload bionic termux-exec bikin glibc proses error).
- Project jangan ditaruh di `/sdcard` (FAT/exfat — noexec + permission).
- Ripgrep auto-download: `arm64-linux → aarch64-unknown-linux-gnu` ✓ cocok glibc.
- Native libs di dalam binary (opentui zig, node-pty, parcel-watcher, fff) —
  semua prebuilt `linux-arm64-gnu`, konsisten di dalam bridge.

## Build dari source (kalau mau rebuild)

Source subset ada di `../lockcode-port/` (PC, butuh bun 1.3.14 + net):

```bash
cd lockcode-port/packages/lockcode
LOCKCODE_CHANNEL=latest LOCKCODE_VERSION=1.18.29 bun run script/build.ts --skip-install
# output: dist/lockcode-linux-arm64/bin/lockcode  +  lockcode-linux-x64 (buat smoke test di PC)
```

## Hasil smoke test (x64 binary, di PC)

- `--version` → 1.18.29 ✓
- `--help` → semua command tampil, brand lockcode ✓
- `models` → 102 model gateway ke-list ✓
- `run` + dummy key → request ke gateway keluar, balasan "Invalid API key" (validasi server) ✓
- TUI → bootstrap opentui OK, layar "Connect a provider" ke-render ✓

Binary arm64 gak bisa dites di PC (x86 host) — tes pertama di HP via install.sh.
