#!/usr/bin/env bash
# Copies the planner's database (lists, settings, connected accounts) to a dated file.
# Usage: deploy/backup.sh [destination-folder]   (default: ~/planner-backups)
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${1:-$HOME/planner-backups}"
mkdir -p "$DEST"
node --disable-warning=ExperimentalWarning -e '
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync("data/planner.db");
  db.exec(`VACUUM INTO "${process.argv[1]}"`);
' "$DEST/planner-$(date +%F).db"
ls -1t "$DEST"/planner-*.db | tail -n +31 | xargs -r rm --
echo "Backed up to $DEST"
