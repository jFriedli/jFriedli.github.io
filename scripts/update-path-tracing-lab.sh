#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
git -C "$repo_dir/labs-src/path-tracing" pull --ff-only origin main
"$repo_dir/scripts/build-site.sh"
echo "Review the build, then commit the updated labs-src/path-tracing submodule pointer."
