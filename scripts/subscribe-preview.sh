#!/bin/zsh
# The newsletter's signup against a deployed preview that sits behind Vercel's login, through the signed-in CLI.
#
#   zsh scripts/subscribe-preview.sh https://<the preview's address>.vercel.app
#
# Needs: the Vercel CLI signed in and this checkout linked (`vercel link --yes --project arav-portfolio --scope arav15`
# writes only the git-ignored .vercel folder), and the table applied to the database the preview uses (`pnpm db:apply`).
#
# Before running, know this: `vercel curl` gets past the login with the project's "protection bypass for automation"
# secret. If the project has none it may make one, which is a change to a project setting: that is the owner's to
# allow. To use an existing secret without that, pass it yourself (it is not printed):
#   VERCEL_AUTOMATION_BYPASS_SECRET=... node scripts/subscribe-e2e.mjs https://<preview> --no-db
#
# It sends six requests as one made-up address at example.com and prints each answer. It cannot see the database, so
# the proof that a row was stored is the second answer ("already"). The test row STAYS: delete it in the Neon console
# with the statement printed at the end. Run it once a minute at most (the sixth request is there to meet the limiter;
# on a preview the requests may reach different instances, and then the sixth is not refused: say so, it is the
# limiter's known limit, not a fault).

set -u
D=${1:?the preview address}
A="n1-test-$(openssl rand -hex 5)@example.com"
R="n1-robot-$(openssl rand -hex 5)@example.com"
J=(--silent --show-error --write-out '\n  -> %{http_code} %header{location} retry-after:%header{retry-after}\n' --header 'Content-Type: application/json' --request POST)
say() { print -- "\n$1"; }
post() { vercel curl /api/subscribe --deployment "$D" -- $J --data "$1" 2>&1 | grep -v '^Vercel CLI'; }

print "preview: $D\ntest address: $A"
say "1. a new address          want 200 subscribed";  post "{\"email\":\"  ${A:u} \",\"source\":\"home\"}"
say "2. the same again         want 200 already";     post "{\"email\":\"$A\",\"source\":\"blog\"}"
say "3. a bad address          want 400 invalid";     post '{"email":"not-an-address"}'
say "4. a filled honeypot      want 200 subscribed (and no row for it)"; post "{\"email\":\"$R\",\"homepage_url\":\"https://example.com/\"}"
say "5. the plain form         want 303 /newsletter/already"
vercel curl /api/subscribe --deployment "$D" -- --silent --show-error --output /dev/null --write-out '  -> %{http_code} %header{location}\n' --request POST --data "email=$A&source=blog&homepage_url=" 2>&1 | grep -v '^Vercel CLI'
say "6. a sixth try            want 429 limited, with retry-after"; post "{\"email\":\"$A\"}"
say "GET                       want 405"
vercel curl /api/subscribe --deployment "$D" -- --silent --output /dev/null --write-out '  -> %{http_code}\n' 2>&1 | grep -v '^Vercel CLI'

print "\nIn the Neon console (SQL editor), to see that the honeypot stored nothing and to remove the test row:"
print "  SELECT count(*) FROM subscribers WHERE email IN ('$A', '$R');   -- want 1"
print "  DELETE FROM subscribers WHERE email = '$A';"
print "  SELECT count(*) FROM subscribers;                               -- what it was before the test"
