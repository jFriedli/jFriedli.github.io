#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cloth_dir="$repo_dir/labs-src/cloth-simulation"
site_dir="$repo_dir/_site"

if [[ ! -f "$cloth_dir/Cargo.toml" ]]; then
  echo "Cloth submodule is missing. Run: git submodule update --init --recursive" >&2
  exit 1
fi

wasm-pack build "$cloth_dir/crates/cloth-wasm" --target web --out-dir ../../web/src/wasm
npm ci --prefix "$cloth_dir/web"
VITE_BASE=/labs/cloth-simulation/ npm run build --prefix "$cloth_dir/web"

mkdir -p "$site_dir"
find "$site_dir" -mindepth 1 -delete
rsync -a --exclude '/.git/' --exclude '/.github/' --exclude '/.gitignore' --exclude '/.gitmodules' --exclude '/_site/' --exclude '/docs/' --exclude '/labs-src/' --exclude '/node_modules/' --exclude '/scripts/' "$repo_dir/" "$site_dir/"
mkdir -p "$site_dir/labs/cloth-simulation"
rsync -a "$cloth_dir/web/dist/" "$site_dir/labs/cloth-simulation/"

test -f "$site_dir/index.html"
test -f "$site_dir/labs/index.html"
test -f "$site_dir/labs/cloth-simulation/index.html"
test -f "$site_dir/CNAME"
grep -qx 'jfriedli.com' "$site_dir/CNAME"
if grep -R -n -E '/wasm-cloth-lab/|src/wasm' "$site_dir/labs/cloth-simulation"; then
  echo "Cloth output contains an invalid standalone/source asset path" >&2
  exit 1
fi
echo "Assembled Pages artifact: $site_dir"
