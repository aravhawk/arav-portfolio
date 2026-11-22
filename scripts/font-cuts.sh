#!/bin/sh
# Cut the Latin files of the two variable fonts (src/fonts/*-Latin.woff2) from the whole fonts (src/fonts/*-VF.woff2).
# Needs fonttools (pyftsubset) with brotli. The ranges here, the unicode-range in src/app/globals.css (their
# complement) and CORE in tests/content/fonts.test.ts say the same thing: change one, change all three.
set -e
cd "$(dirname "$0")/../src/fonts"
RANGES="U+0020-007E,U+00A0-00BF,U+2010-202F,U+2190-2199,U+2212,U+2713,U+FEFF,U+FFFD"
# What the browser applies by default, and what the site's CSS asks for (tabular and lining figures, the slashed zero).
FEATURES="calt,ccmp,clig,curs,dnom,frac,kern,liga,locl,mark,mkmk,numr,rclt,rlig,rvrn,tnum,lnum,pnum,onum,zero,case,ordn,sups,subs,sinf"
for f in TASAOrbiter SplineSansMono; do
  pyftsubset "$f-VF.woff2" --unicodes="$RANGES" --layout-features="$FEATURES" --flavor=woff2 --name-IDs='*' --output-file="$f-Latin.woff2"
  ls -l "$f-Latin.woff2"
done
