#!/usr/bin/env bash
# run-all-carts.sh — verify every cart in carts/ runs without error.
#
# Usage:
#   scripts/run-all-carts.sh          — run all
#   scripts/run-all-carts.sh --quiet  — only print PASS/FAIL summary
#
# Exits 0 if all carts pass, 1 if any fails.

set -u

QUIET=false
if [[ "${1:-}" == "--quiet" ]]; then QUIET=true; fi

cd "$(dirname "$0")/.."

CLI="./bin/sakura-scheme"
if [[ ! -x "$CLI" ]]; then
  echo "cannot find $CLI"; exit 1
fi

pass=0
fail=0
fails=()
total_start=$(date +%s)

# Iterate every .scm under carts/, in stable order.
for cart in $(find carts -name '*.scm' | sort); do
  start=$(date +%s)
  if $QUIET; then
    if "$CLI" run "$cart" >/dev/null 2>&1; then
      pass=$((pass + 1))
    else
      fail=$((fail + 1)); fails+=("$cart")
    fi
  else
    echo "── $cart"
    if "$CLI" run "$cart" >/dev/null 2>&1; then
      end=$(date +%s); dur=$((end - start))
      echo "   PASS (${dur}s)"
      pass=$((pass + 1))
    else
      echo "   FAIL"
      fail=$((fail + 1)); fails+=("$cart")
    fi
  fi
done

total_end=$(date +%s)
total=$((total_end - total_start))

echo ""
echo "── summary ──"
echo "  pass  : $pass"
echo "  fail  : $fail"
echo "  total : ${total}s"

if [[ $fail -gt 0 ]]; then
  echo ""
  echo "failures:"
  for f in "${fails[@]}"; do echo "  $f"; done
  exit 1
fi

exit 0
