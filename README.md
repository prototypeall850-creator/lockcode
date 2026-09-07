# lockcode

Port [opencode](https://opencode.ai) 1.18.29 → **lockcode** — binary tunggal `linux-arm64`
jalan **native di Termux (Android, aarch64)** lewat glibc bridge, tanpa proot, tanpa root.
Brand diubah jadi lockcode, kontrak eksternal (gateway/auth opencode) tetap hidup.

## Isi repo

| Path | Isi |
|---|---|
| `deliver/lockcode-arm64` | binary jadi — **JANGAN di-push ke git biasa** (141MB > limit GitHub 100MB). Lihat cara distribute di bawah |
| `deliver/install.sh` | installer Termux otomatis |
| `deliver/README.md` | dokumentasi lengkap |
| `packages/`, `patches/`, `bun.lock` | source subset (bisa rebuild) |

## Cara distribute binary (pilih salah satu)

**1. GitHub Release (paling gampang):**
```bash
gh release create v1.18.29 deliver/lockcode-arm64 --notes "lockcode arm64"
```

**2. Git LFS:**
```bash
git lfs install
git lfs track "deliver/lockcode-arm64"
git add deliver/lockcode-arm64 .gitattributes
git commit -m "binary via LFS"
```

**3. Manual**: file transfer (gak lewat git) ke HP.

## Install di HP (Termux)

```bash
pkg install -y git
# taruh lockcode-arm64 + install.sh di folder yang sama, mis ~/lockcode/
cd ~/lockcode && bash install.sh
```

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
LOCKCODE_CHANNEL=latest LOCKCODE_VERSION=1.18.29 bun run script/build.ts --skip-install
# output: dist/lockcode-linux-arm64/bin/lockcode
```

Detail perubahan + whitelist kontrak eksternal: lihat `deliver/README.md`.
