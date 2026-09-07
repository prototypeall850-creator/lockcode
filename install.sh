#!/data/data/com.termux/files/usr/bin/bash
# lockcode installer — curl -fsSL https://raw.githubusercontent.com/prototypeall850-creator/lockcode/main/install.sh | bash
# mirror pola opencode install: detect termux → pasang glibc runtime → download binary terbaru → wrapper
set -euo pipefail

REPO="prototypeall850-creator/lockcode"
BASE="https://github.com/$REPO/releases"
RAW="https://raw.githubusercontent.com/$REPO/main"
APP="$PREFIX/glibc/opt/lockcode/bin"
BIN="$APP/lockcode"
LD="$PREFIX/glibc/lib/ld-linux-aarch64.so.1"

say() { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
die() { printf "\033[1;31mERROR:\033[0m %s\n" "$*" >&2; exit 1; }

command -v pkg >/dev/null 2>&1 || die "jalankan installer ini di dalam Termux"
command -v uname >/dev/null 2>&1 && [ "$(uname -m)" = "aarch64" ] || die "butuh arsitektur aarch64"

VERSION="${1:-latest}"   # bisa: curl ... | bash -s v0.1.1

say "lockcode installer (Termux native, tanpa proot/root)"

say "[1/5] Tambah repo termux-glibc + install glibc-runner"
mkdir -p "$PREFIX/etc/apt/sources.list.d"
echo "deb https://packages-cf.termux.dev/apt/termux-glibc/ glibc stable" > "$PREFIX/etc/apt/sources.list.d/glibc.list"
pkg update -y
pkg install -y glibc glibc-runner patchelf curl

[ -x "$LD" ] || die "glibc runtime gak kepasang ($LD gak ada)"

say "[2/5] Download binary (versi: $VERSION)"
mkdir -p "$APP"
if [ "$VERSION" = "latest" ]; then
  URL="$BASE/latest/download/lockcode-arm64"
else
  URL="$BASE/download/$VERSION/lockcode-arm64"
fi
curl -fSL --progress-bar -o "$BIN.tmp" "$URL" || die "download gagal ($URL)"
install -m 0755 "$BIN.tmp" "$BIN" && rm -f "$BIN.tmp"

say "[3/5] Pasang wrapper $PREFIX/bin/lockcode"
cat > "$PREFIX/bin/lockcode" <<WEOF
#!/data/data/com.termux/files/usr/bin/bash
# lockcode — glibc bridge launcher (native Termux, tanpa proot)
unset LD_PRELOAD
exec "\$PREFIX/glibc/lib/ld-linux-aarch64.so.1" \\
  --library-path "\$PREFIX/glibc/lib" \\
  "\$PREFIX/glibc/opt/lockcode/bin/lockcode" "\$@"
WEOF
chmod 0755 "$PREFIX/bin/lockcode"

say "[4/5] Smoke test"
INSTALLED=$("$PREFIX/bin/lockcode" --version) || die "binary gak mau jalan — kirim output error ini ke $REPO/issues"
say "terpasang lockcode $INSTALLED"

say "[5/5] Selesai!"
echo ""
echo "  lockcode                 → TUI interaktif"
echo "  lockcode auth login      → login gateway"
echo "  lockcode run \"pesan\"     → non-interaktif"
echo "  lockcode models          → list model"
echo ""
echo "Update ke versi baru kapan aja: jalankan ulang installer ini."
