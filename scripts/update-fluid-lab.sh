#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
git -C "$repo_dir/labs-src/fluid-simulation" pull --ff-only origin main
"$repo_dir/scripts/build-site.sh"
echo "Review the build, then commit the updated labs-src/fluid-simulation submodule pointer."
