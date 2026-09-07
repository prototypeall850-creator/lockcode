#!/data/data/com.termux/files/usr/bin/bash
# lockcode installer untuk Termux (aarch64) — jalankan dari folder berisi file `lockcode-arm64`
set -euo pipefail

echo "== lockcode installer (Termux native, tanpa proot) =="

command -v pkg >/dev/null 2>&1 || { echo "ERROR: jalankan script ini di Termux"; exit 1; }
[ "$(uname -m)" = "aarch64" ] || { echo "ERROR: butuh arsitektur aarch64"; exit 1; }

SRC="$(cd "$(dirname "$0")" && pwd)/lockcode-arm64"
[ -f "$SRC" ] || { echo "ERROR: file lockcode-arm64 tidak ada di sebelah install.sh"; exit 1; }

echo "[1/4] Tambah repo termux-glibc + install glibc-runner"
mkdir -p "$PREFIX/etc/apt/sources.list.d"
echo "deb https://packages-cf.termux.dev/apt/termux-glibc/ glibc stable" > "$PREFIX/etc/apt/sources.list.d/glibc.list"
pkg update -y
pkg install -y glibc glibc-runner patchelf

echo "[2/4] Pasang binary"
mkdir -p "$PREFIX/glibc/opt/lockcode/bin"
install -m 0755 "$SRC" "$PREFIX/glibc/opt/lockcode/bin/lockcode"

echo "[3/4] Buat wrapper \$PREFIX/bin/lockcode"
cat > "$PREFIX/bin/lockcode" <<'WEOF'
#!/data/data/com.termux/files/usr/bin/bash
# lockcode — glibc bridge launcher (native Termux, tanpa proot)
unset LD_PRELOAD
exec "$PREFIX/glibc/lib/ld-linux-aarch64.so.1" \
  --library-path "$PREFIX/glibc/lib" \
  "$PREFIX/glibc/opt/lockcode/bin/lockcode" "$@"
WEOF
chmod 0755 "$PREFIX/bin/lockcode"

echo "[4/4] Smoke test"
"$PREFIX/bin/lockcode" --version

echo ""
echo "Selesai. Pakai: lockcode  (TUI) | lockcode run \"...\" | lockcode auth login"
