#!/usr/bin/env bash
# Regenerates the splash artwork:
#   assets/splash-icon.png  Android's system splash (Android 12+ only allows a
#                           centered icon): the cart logo in a white circle.
#   assets/splash.jpg       The full splash shown right after it (by
#                           screens/SplashScreen.js). The logo circle sits at
#                           exactly the same spot and size, so the hand-off
#                           looks like one screen finishing loading.
# Needs: rsvg-convert, ImageMagick 7 (magick), node_modules (Poppins fonts).
# Run from the project root:  bash scripts/make-splash.sh
set -euo pipefail

OUT=assets
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FONTS=node_modules/@expo-google-fonts/poppins
BG='#F6FAF7'          # keep in sync with app.json expo-splash-screen backgroundColor

# The cart logo, drawn on a 1024 canvas around (497, 543).
ART='
  <path d="M598 452 C600 360 655 312 742 298 C735 388 686 440 598 452 Z" fill="url(#leafA)"/>
  <path d="M548 446 C528 404 538 370 574 350 C592 392 582 426 548 446 Z" fill="url(#leafB)"/>
  <path d="M214 392 H282 L348 560" fill="none" stroke="url(#cart)" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M330 470 H756 Q790 470 780 503 L722 676 Q712 704 682 704 H414 Q386 704 377 677 L318 506 Q308 470 330 470 Z" fill="url(#cart)"/>
  <path d="M478 666 C478 578 540 528 628 522 C626 610 568 664 478 666 Z" fill="#FBFDFB"/>
  <path d="M492 654 C530 610 566 578 604 552" fill="none" stroke="url(#cart)" stroke-width="13" stroke-linecap="round"/>
  <rect x="452" y="768" width="190" height="20" rx="10" fill="#8CC79C"/>
  <circle cx="452" cy="778" r="42" fill="url(#cart)"/>
  <circle cx="642" cy="778" r="42" fill="url(#cart)"/>'
DEFS='<defs>
  <linearGradient id="cart" gradientUnits="userSpaceOnUse" x1="214" y1="300" x2="790" y2="820"><stop offset="0" stop-color="#14532B"/><stop offset="1" stop-color="#1F7A44"/></linearGradient>
  <linearGradient id="leafA" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3E9A4F"/><stop offset="1" stop-color="#7CC243"/></linearGradient>
  <linearGradient id="leafB" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1F7A44"/><stop offset="1" stop-color="#4DA85A"/></linearGradient>
  <linearGradient id="wave" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14532B"/><stop offset="1" stop-color="#2E9A5A"/></linearGradient>
</defs>'

# ── Logo circle size and position on the full splash ─────────────────────
# Android shows the system splash icon at 192dp, centered on the screen. On
# a typical phone the full splash (1284x2778, drawn with "cover") is scaled
# ~0.32 dp per pixel, so a 192dp circle is ~590px, centered at y = 1389.
R=295; CX=642; CY=1389
ART_SCALE=0.733        # cart size inside the circle
ART_DY=9               # cart sits slightly below the circle's center

# 1) System splash icon: the circle fills the whole image (imageWidth: 192).
cat > "$TMP/icon.svg" <<EOF
<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'>$DEFS
<circle cx='512' cy='512' r='512' fill='#FFFFFF'/>
<g transform='translate(512 $(awk "BEGIN{print 512 + $ART_DY*512/$R}")) scale($(awk "BEGIN{print $ART_SCALE*512/$R}")) translate(-497 -543)'>$ART</g></svg>
EOF
rsvg-convert -w 1024 -h 1024 "$TMP/icon.svg" -o "$OUT/splash-icon.png"

# 2) Full splash: background, corner waves, the same circle + cart.
cat > "$TMP/full.svg" <<EOF
<svg xmlns='http://www.w3.org/2000/svg' width='1284' height='2778' viewBox='0 0 1284 2778'>$DEFS
<rect width='1284' height='2778' fill='$BG'/>
<path d='M620 0 H760 C640 170 420 260 0 420 V330 C330 210 520 120 620 0 Z' fill='#8CC79C' opacity='0.7'/>
<path d='M0 0 H620 C520 120 330 210 0 330 Z' fill='url(#wave)'/>
<path d='M760 2778 H640 C760 2650 980 2570 1284 2520 V2590 C1010 2630 850 2700 760 2778 Z' fill='#8CC79C' opacity='0.75'/>
<path d='M1284 2778 H760 C850 2700 1010 2630 1284 2590 Z' fill='url(#wave)'/>
<circle cx='$CX' cy='$CY' r='$R' fill='#FFFFFF'/>
<g transform='translate($CX $((CY + ART_DY))) scale($ART_SCALE) translate(-497 -543)'>$ART</g></svg>
EOF
rsvg-convert -w 1284 -h 2778 "$TMP/full.svg" -o "$TMP/full.png"

# Campus photo, tinted green and faded in at the bottom (behind the waves).
BAND_H=760
magick "$OUT/slsu-campus.jpg" -crop 1086x690+0+540 +repage -resize 1284x$BAND_H\! \
  -colorspace gray -level 5%,95% +level-colors '#2E7D4A',"$BG" "$TMP/campus.png"
magick -size 1284x$BAND_H gradient:'#000000'-'#FFFFFF' -sigmoidal-contrast 4,40% "$TMP/fade.png"
magick "$TMP/campus.png" "$TMP/fade.png" -alpha off -compose CopyOpacity -composite \
  -channel A -evaluate multiply 0.55 +channel "$TMP/band.png"

TOP=$((CY + R + 56))
# The bottom waves must stay on top of the photo: redraw them over it.
cat > "$TMP/top.svg" <<EOF
<svg xmlns='http://www.w3.org/2000/svg' width='1284' height='2778' viewBox='0 0 1284 2778'>$DEFS
<path d='M760 2778 H640 C760 2650 980 2570 1284 2520 V2590 C1010 2630 850 2700 760 2778 Z' fill='#8CC79C' opacity='0.75'/>
<path d='M1284 2778 H760 C850 2700 1010 2630 1284 2590 Z' fill='url(#wave)'/></svg>
EOF
rsvg-convert -w 1284 -h 2778 "$TMP/top.svg" -o "$TMP/top.png"
magick "$TMP/full.png" "$TMP/band.png" -geometry +0+$((2778 - BAND_H)) -composite "$TMP/top.png" -composite \
  -font "$FONTS/700Bold/Poppins_700Bold.ttf" -pointsize 92 -fill '#14532B' -gravity north -annotate +0+$TOP 'SLSU-GumaCart' \
  -font "$FONTS/500Medium/Poppins_500Medium.ttf" -pointsize 40 -fill '#59645C' -annotate +0+$((TOP + 130)) 'Buy  •  Sell  •  Exchange  •  Donate' \
  -font "$FONTS/600SemiBold/Poppins_600SemiBold.ttf" -pointsize 30 -fill '#1F7A44' -annotate +0+$((TOP + 208)) 'SOUTHERN LUZON STATE UNIVERSITY  ·  GUMACA' \
  -alpha off -strip -sampling-factor 4:4:4 -quality 88 "$OUT/splash.jpg"

echo "Wrote $OUT/splash-icon.png and $OUT/splash.jpg (text starts at y=$TOP)"
