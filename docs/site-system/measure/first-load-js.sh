#!/bin/sh
# The gzipped bytes of every script a route's HTML asks for, and a check that none holds the
# renderer (createShader) or the sound graph (createBiquadFilter).
#
#   docs/site-system/measure/first-load-js.sh <base> [route]
#   docs/site-system/measure/first-load-js.sh http://localhost:3189 /work
#
# The sum includes Next's nomodule polyfill (about 39 KB), which a modern browser never fetches.
set -eu
base=$1
route=${2:-/}
total=0
found=
for src in $(curl -fsS "$base$route" | grep -o '<script[^>]*src="[^"]*"' | sed 's/.*src="//; s/"$//' | sort -u); do
  body=$(mktemp)
  curl -fsS "$base$src" -o "$body"
  bytes=$(gzip -9 -c "$body" | wc -c | tr -d ' ')
  total=$((total + bytes))
  if grep -q -e 'createShader' -e 'createBiquadFilter' "$body"; then found="$found $src"; fi
  rm -f "$body"
  echo "$bytes $src"
done
echo "total $total bytes gzipped for $route"
if [ -n "$found" ]; then
  echo "FAIL: scene or sound code in the first load:$found"
  exit 1
fi
echo "ok: no WebGL or audio code in these scripts"
