#!/bin/sh
# Lighthouse's phone and desktop presets on each route of a production build, as a table.
#
#   docs/site-system/measure/lighthouse.sh <base> <outdir> <route>...
#   docs/site-system/measure/lighthouse.sh http://localhost:3189 .tools/out/lh / /work /work/infiniview /blog
#
# Lighthouse and a Chromium are not dependencies of the site. Set LIGHTHOUSE and CHROME_PATH, or
# keep them where the owner's machine has them (the defaults below).
# The gate: performance 95 or more on the phone and 100 on the desktop; the other three 100;
# LCP under 2000 ms phone and 1200 ms desktop; CLS under 0.02; longest task 50 ms or under.
set -eu
base=$1
out=$2
shift 2
lh=${LIGHTHOUSE:-$HOME/.t3/portfolio-redesign-v4/tools/node_modules/.bin/lighthouse}
if [ -z "${CHROME_PATH:-}" ]; then
  CHROME_PATH=$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/* | tail -1)
fi
export CHROME_PATH
mkdir -p "$out"
for route in "$@"; do
  name=$(echo "$route" | sed 's#^/##; s#/#_#g')
  [ -n "$name" ] || name=home
  for preset in mobile desktop; do
    flag=
    [ "$preset" = desktop ] && flag=--preset=desktop
    "$lh" "$base$route" $flag --only-categories=performance,accessibility,best-practices,seo \
      --output=json --output-path="$out/$name-$preset.json" \
      --chrome-flags="--headless=new --no-sandbox" --quiet >/dev/null 2>&1 || echo "failed: $route $preset" >&2
  done
done
node -e '
const fs = require("fs"), dir = process.argv[1];
console.log(["page", "perf", "a11y", "bp", "seo", "LCP ms", "CLS", "TBT ms", "longest task ms", "script KB"].join("\t"));
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(dir + "/" + f)), a = j.audits, c = j.categories;
  const score = (k) => Math.round(c[k].score * 100);
  const tasks = (a["long-tasks"]?.details?.items ?? []).map((i) => i.duration);
  const js = (a["network-requests"]?.details?.items ?? []).filter((i) => i.resourceType === "Script").reduce((s, i) => s + (i.transferSize || 0), 0);
  console.log([f.replace(".json", ""), score("performance"), score("accessibility"), score("best-practices"), score("seo"),
    Math.round(a["largest-contentful-paint"].numericValue), a["cumulative-layout-shift"].numericValue.toFixed(3),
    Math.round(a["total-blocking-time"].numericValue), tasks.length ? Math.round(Math.max(...tasks)) : 0, Math.round(js / 1024)].join("\t"));
}
' "$out" | tee "$out/table.tsv"
