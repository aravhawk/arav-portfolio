#!/bin/sh
# Cut the Latin files of the two variable fonts (src/fonts/*-Latin.woff2) from the whole fonts (src/fonts/*-VF.woff2).
# Needs fonttools (pyftsubset) with brotli. The ranges here, the unicode-range in src/app/globals.css (their
# complement) and CORE in tests/content/fonts.test.ts say the same thing: change one, change all three.
set -e
cd "$(dirname "$0")/../src/fonts"
RANGES="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-209F,U+20A0-20BF,U+2100-214F,U+2190-23FF,U+25A0-27BF,U+FB00-FB06,U+FEFF,U+FFFD"
# What the browser applies by default, and what the site's CSS asks for (tabular and lining figures, the slashed zero).
FEATURES="calt,ccmp,clig,curs,dnom,frac,kern,liga,locl,mark,mkmk,numr,rclt,rlig,rvrn,tnum,lnum,pnum,onum,zero,case,ordn,sups,subs,sinf"
for f in TASAOrbiter SplineSansMono; do
  pyftsubset "$f-VF.woff2" --unicodes="$RANGES" --layout-features="$FEATURES" --flavor=woff2 --name-IDs='*' --output-file="$f-Latin.woff2"
  ls -l "$f-Latin.woff2"
done
