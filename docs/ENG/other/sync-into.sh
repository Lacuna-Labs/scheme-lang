#!/usr/bin/env bash
# sync-into.sh — copy this canonical scheme-lang into a target project.
#
# Usage:
#   ./scripts/sync-into.sh /path/to/target-project
#
# Target project ends up with:
#   <target>/scheme-lang/
#     ├── (sync'd subdirs — do not edit, they get overwritten)
#     │   bin/  src/  docs/  tests/
#     └── (local subdirs — preserved on sync)
#         verbs/  adapters/  dialect.json
#
# The sync overwrites SYNC'D subdirs on every run. LOCAL subdirs are
# never touched.

set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ] || [ ! -d "$TARGET" ]; then
  echo "usage: $0 <target-project-directory>" >&2
  exit 1
fi

SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$TARGET/scheme-lang"

echo "→ sync scheme-lang: $SOURCE  →  $DEST"

# Sync only these — LOCAL subdirs (verbs/, adapters/, dialect.json) are preserved.
SYNC=(bin src docs tests README.md TEMPLATE-FOR-FORKS.md scripts LICENSE .gitignore)

mkdir -p "$DEST"
for path in "${SYNC[@]}"; do
  if [ -e "$SOURCE/$path" ]; then
    rsync -a --delete "$SOURCE/$path" "$DEST/"
    echo "   ✓ $path"
  fi
done

# Marker file so target project developers know these subdirs are managed.
cat > "$DEST/.MANAGED" <<'EOF'
# Managed by canonical scheme-lang sync.
#
# The following subdirs are OVERWRITTEN by ./scripts/sync-into.sh:
#   bin/  src/  docs/  tests/  scripts/  README.md  TEMPLATE-FOR-FORKS.md  LICENSE
#
# LOCAL subdirs (preserved across syncs):
#   verbs/  adapters/  dialect.json
#
# Edit LOCAL subdirs freely. Edits to SYNC'D subdirs will be lost on next sync.
# To modify the base, PR against Lacuna-Labs/scheme-lang.
EOF

echo "✓ synced. see $DEST/.MANAGED"
