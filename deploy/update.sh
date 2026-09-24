#!/usr/bin/env bash
# Pull the latest version from GitHub, rebuild, and restart. Run nightly by cron, or by hand any time.
# The screen notices the restart and reloads itself.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && [ "${1:-}" != "--force" ]; then
  echo "$(date): already up to date"
  exit 0
fi
git merge --ff-only origin/main
npm ci
npm run build
sudo systemctl restart home-planner
echo "$(date): updated to $(git rev-parse --short HEAD)"
