#!/usr/bin/env bash
# scheme-lang installer
#
# usage:
#   curl -fsSL https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.sh | sh
#
# what it does:
#   1. clones scheme-lang into ~/.scheme-lang/repo (or updates if it's there)
#   2. symlinks bin/scheme-lang into a directory on your PATH
#      preference order: ~/.local/bin  →  /usr/local/bin  →  ~/bin
#   3. verifies node is available (Node 18+)
#
# uninstall:
#   rm -rf ~/.scheme-lang $(command -v scheme-lang)

set -eu

REPO_URL="https://github.com/Lacuna-Labs/scheme-lang"
INSTALL_ROOT="$HOME/.scheme-lang"
REPO_DIR="$INSTALL_ROOT/repo"

say()  { printf '  %s\n' "$*"; }
fail() { printf '  ✗ %s\n' "$*" >&2; exit 1; }

command -v git  >/dev/null || fail "git is required"
command -v node >/dev/null || fail "node is required (v18+)"

# Node version check
node_major=$(node -e 'console.log(process.versions.node.split(".")[0])')
[ "$node_major" -ge 18 ] || fail "node $node_major is too old — need v18+"

# Clone or update
if [ -d "$REPO_DIR/.git" ]; then
  say "updating scheme-lang…"
  git -C "$REPO_DIR" pull --ff-only >/dev/null 2>&1 || fail "could not update — check $REPO_DIR"
else
  say "cloning scheme-lang…"
  mkdir -p "$INSTALL_ROOT"
  git clone --quiet --depth 1 "$REPO_URL" "$REPO_DIR" || fail "clone failed"
fi

chmod +x "$REPO_DIR/bin/scheme-lang" "$REPO_DIR/bin/sakura-scheme"

# Find a PATH-friendly bin directory
for candidate in "$HOME/.local/bin" "/usr/local/bin" "$HOME/bin"; do
  case ":$PATH:" in
    *":$candidate:"*)
      if [ -w "$candidate" ] || { [ ! -e "$candidate" ] && mkdir -p "$candidate" 2>/dev/null; }; then
        BINDIR="$candidate"
        break
      fi
      ;;
  esac
done

if [ -z "${BINDIR:-}" ]; then
  say ""
  say "no writable directory on your PATH — creating ~/.local/bin"
  mkdir -p "$HOME/.local/bin"
  BINDIR="$HOME/.local/bin"
  say "add this to your shell rc if it isn't already:"
  say "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

ln -sf "$REPO_DIR/bin/scheme-lang"   "$BINDIR/scheme-lang"
ln -sf "$REPO_DIR/bin/sakura-scheme" "$BINDIR/sakura-scheme"

say ""
say "installed."
say ""
say "  $BINDIR/scheme-lang    →    $REPO_DIR/bin/scheme-lang"
say ""
say "try:  scheme-lang"
say "or:   scheme-lang eval \"(+ 1 2)\""
