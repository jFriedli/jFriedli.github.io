#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
git -C "$repo_dir/labs-src/open-ebus-lab" pull --ff-only origin main
"$repo_dir/scripts/build-site.sh"
echo "Review the build, then commit the updated labs-src/open-ebus-lab submodule pointer."
