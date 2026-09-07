# lockcode

Port [opencode](https://opencode.ai) 1.18.29 → **lockcode** (versi sendiri, mulai `v0.1.0`) — binary tunggal `linux-arm64`
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
gh release create v0.1.0 deliver/lockcode-arm64 --generate-notes
```

**2. Git LFS:**
```bash
git lfs install
git lfs track "deliver/lockcode-arm64"
git add deliver/lockcode-arm64 .gitattributes
git commit -m "binary via LFS"
```

**3. Manual**: file transfer (gak lewat git) ke HP.

## Install di HP (Termux) — satu command

```bash
curl -fsSL https://raw.githubusercontent.com/prototypeall850-creator/lockcode/main/install.sh | bash
```

Installer otomatis: pasang repo glibc + glibc-runner, download binary **terbaru**
dari GitHub Releases, bikin wrapper. Pin versi tertentu:
`curl ... | bash -s v0.1.1`

## Update

```bash
# di PC: build versi baru
NEW=0.1.1
cd packages/lockcode
LOCKCODE_CHANNEL=latest LOCKCODE_VERSION=$NEW bun run script/build.ts --skip-install
cp dist/lockcode-linux-arm64/bin/lockcode ../../deliver/lockcode-arm64
gh release create v$NEW deliver/lockcode-arm64 --generate-notes
# di HP: jalankan ulang installer → dapat versi terbaru
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
LOCKCODE_CHANNEL=latest LOCKCODE_VERSION=0.1.0 bun run script/build.ts --skip-install
# output: dist/lockcode-linux-arm64/bin/lockcode
```

Detail perubahan + whitelist kontrak eksternal: lihat `deliver/README.md`.
