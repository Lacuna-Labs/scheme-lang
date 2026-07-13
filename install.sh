#!/usr/bin/env bash
# scheme-lang installer — macOS + Linux
#
# usage:
#   curl -fsSL https://raw.githubusercontent.com/Lacuna-Labs/scheme-lang/main/install.sh | sh
#
# what it does:
#   1. clones scheme-lang into ~/.scheme-lang/repo (or updates in place if present)
#   2. symlinks bin/scheme-lang + bin/sakura-scheme into a directory on your PATH
#      preference order: ~/.local/bin  →  /usr/local/bin  →  ~/bin
#      falls back to creating ~/.local/bin and telling you how to add it to PATH
#   3. verifies node (v18+) and git are available
#
# tested on:
#   macOS 14/15 (Intel + Apple Silicon), Ubuntu 22.04/24.04, Debian 12,
#   Fedora 40, Arch (as of 2026-07). POSIX-friendly bash.
#
# uninstall:
#   rm -rf ~/.scheme-lang
#   rm -f  ~/.local/bin/scheme-lang ~/.local/bin/sakura-scheme
#   # (or wherever the symlinks landed — the installer prints the exact path)

set -eu

REPO_URL="https://github.com/Lacuna-Labs/scheme-lang"
INSTALL_ROOT="$HOME/.scheme-lang"
REPO_DIR="$INSTALL_ROOT/repo"

say()  { printf '  %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*" >&2; }
fail() { printf '  x %s\n' "$*" >&2; exit 1; }

# ---- prereqs ----------------------------------------------------------------

command -v git  >/dev/null 2>&1 || fail "git is required — install it and re-run"
command -v node >/dev/null 2>&1 || fail "node is required (v18+) — install from https://nodejs.org and re-run"

node_major=$(node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
case "$node_major" in
  ''|*[!0-9]*) fail "could not read node version — is 'node --version' working?" ;;
esac
[ "$node_major" -ge 18 ] || fail "node $node_major is too old — need v18+ (yours: $(node --version))"

# ---- platform ---------------------------------------------------------------

OS="$(uname -s 2>/dev/null || echo unknown)"
case "$OS" in
  Darwin) PLATFORM="macOS" ;;
  Linux)  PLATFORM="Linux" ;;
  *)      PLATFORM="$OS" ; warn "untested platform: $OS — proceeding anyway" ;;
esac

# ---- clone or update --------------------------------------------------------

if [ -d "$REPO_DIR/.git" ]; then
  say "updating scheme-lang in $REPO_DIR..."
  git -C "$REPO_DIR" fetch --quiet origin main 2>/dev/null || warn "fetch failed — using local copy"
  git -C "$REPO_DIR" pull --ff-only --quiet 2>/dev/null || warn "could not fast-forward — you may have local changes in $REPO_DIR"
else
  # clean up any stale directory that isn't a git checkout
  if [ -e "$REPO_DIR" ]; then
    warn "$REPO_DIR exists but is not a git checkout — removing"
    rm -rf "$REPO_DIR"
  fi
  say "cloning scheme-lang into $REPO_DIR..."
  mkdir -p "$INSTALL_ROOT"
  git clone --quiet --depth 1 "$REPO_URL" "$REPO_DIR" || fail "clone failed — check network + that $REPO_URL is reachable"
fi

chmod +x "$REPO_DIR/bin/scheme-lang" "$REPO_DIR/bin/sakura-scheme" 2>/dev/null || true

# ---- pick a bin directory on PATH ------------------------------------------

BINDIR=""
for candidate in "$HOME/.local/bin" "/usr/local/bin" "$HOME/bin"; do
  case ":$PATH:" in
    *":$candidate:"*)
      # already on PATH — use it if writable (or creatable)
      if [ -d "$candidate" ] && [ -w "$candidate" ]; then
        BINDIR="$candidate"; break
      elif [ ! -e "$candidate" ] && mkdir -p "$candidate" 2>/dev/null; then
        BINDIR="$candidate"; break
      fi
      ;;
  esac
done

NEEDS_PATH_HINT=""
if [ -z "$BINDIR" ]; then
  # nothing on PATH is writable — create ~/.local/bin and tell them
  BINDIR="$HOME/.local/bin"
  mkdir -p "$BINDIR"
  NEEDS_PATH_HINT="yes"
fi

# ---- link -------------------------------------------------------------------

ln -sf "$REPO_DIR/bin/scheme-lang"   "$BINDIR/scheme-lang"
ln -sf "$REPO_DIR/bin/sakura-scheme" "$BINDIR/sakura-scheme"

# ---- shell + rc guess for the hint -----------------------------------------

# Best-effort guess of the user's shell rc file so they don't have to think.
guess_rc() {
  # Prefer $SHELL basename; fall back to what actually exists in $HOME.
  sh="$(basename "${SHELL:-}" 2>/dev/null || true)"
  case "$sh" in
    zsh)  printf '%s\n' "$HOME/.zshrc" ; return ;;
    bash) # macOS uses .bash_profile more often; Linux uses .bashrc
          if [ "$PLATFORM" = "macOS" ] && [ -f "$HOME/.bash_profile" ]; then
            printf '%s\n' "$HOME/.bash_profile"; return
          fi
          printf '%s\n' "$HOME/.bashrc" ; return ;;
    fish) printf '%s\n' "$HOME/.config/fish/config.fish" ; return ;;
  esac
  # Fall-through: pick the first that exists.
  for f in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
    [ -f "$f" ] && { printf '%s\n' "$f"; return; }
  done
  printf '%s\n' "$HOME/.profile"
}

RC="$(guess_rc)"

# ---- report -----------------------------------------------------------------

say ""
say "installed on $PLATFORM."
say ""
say "  $BINDIR/scheme-lang     ->  $REPO_DIR/bin/scheme-lang"
say "  $BINDIR/sakura-scheme   ->  $REPO_DIR/bin/sakura-scheme"
say ""

if [ -n "$NEEDS_PATH_HINT" ]; then
  case "$RC" in
    *fish*) PATH_LINE="set -gx PATH \$HOME/.local/bin \$PATH" ;;
    *)      PATH_LINE="export PATH=\"\$HOME/.local/bin:\$PATH\"" ;;
  esac

  # Append idempotently to the shell rc so the command is in the user's env
  # in every new shell. We use a fixed marker line so a second install run
  # doesn't stack duplicates.
  MARKER="# added by scheme-lang installer"
  if [ -f "$RC" ] && grep -Fq "$MARKER" "$RC"; then
    say "$RC already has our PATH line — leaving as-is."
  else
    mkdir -p "$(dirname "$RC")" 2>/dev/null || true
    {
      printf '\n%s\n' "$MARKER"
      printf '%s\n'   "$PATH_LINE"
    } >> "$RC"
    say "added $BINDIR to PATH in $RC."
  fi

  say ""
  say "open a new terminal, or run:  source $RC"
  say ""
fi

say "try:"
say "  sakura-scheme                     # REPL"
say "  sakura-scheme eval \"(+ 1 2)\"      # one-shot"
say ""
say "uninstall:"
say "  rm -rf $INSTALL_ROOT"
say "  rm -f $BINDIR/scheme-lang $BINDIR/sakura-scheme"
