#!/usr/bin/env bash
# Regenerates the splash artwork:
#   assets/splash-icon.png  Android's system splash (Android 12+ only allows a
#                           centered icon): the logo in a white circle.
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

# The GumaCart logo (a G-shaped cart: blue top arc, green lower curve, the
# SLSU building in the basket). Drawn around (470, 525); wrapped so it sits
# around (497, 543) at the size the old cart had.
ART='
<g transform="translate(497 543) scale(0.75) translate(-470 -525)">
<g id="art">
  <!-- lower green curve of the G (outline + fill) -->
  <path d="M262 470 C205 650 300 868 520 876 C700 882 806 772 792 648" fill="none" stroke="#0E6B30" stroke-width="84" stroke-linecap="round"/>
  <path d="M262 470 C205 650 300 868 520 876 C700 882 806 772 792 648" fill="none" stroke="#22B04B" stroke-width="54" stroke-linecap="round"/>
  <!-- handle -->
  <path d="M140 338 H238 Q282 338 300 392" fill="none" stroke="#0E6B30" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M140 338 H238 Q282 338 300 392" fill="none" stroke="#22B04B" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- blue top arc of the G -->
  <path d="M318 430 C292 268 408 168 548 166 C650 165 724 206 768 266" fill="none" stroke="#1F66C9" stroke-width="66" stroke-linecap="round"/>
  <circle cx="768" cy="266" r="33" fill="#0E6B30"/>
  <!-- basket -->
  <path d="M296 412 Q540 372 796 398 L738 642 Q729 672 698 672 H392 Q362 672 353 644 Z" fill="#0E6B30" stroke="#1F66C9" stroke-width="34" stroke-linejoin="round"/>
  <!-- SLSU -->
  <text x="548" y="496" text-anchor="middle" font-family="Noto Sans, DejaVu Sans, sans-serif" font-weight="900" font-size="74" fill="#FFFFFF" letter-spacing="4">SLSU</text>
  <!-- campus building -->
  <g fill="#FFFFFF">
    <rect x="404" y="584" width="288" height="62" rx="4"/>
    <path d="M478 646 V556 Q548 512 618 556 V646 Z"/>
    <rect x="392" y="574" width="312" height="14" rx="5"/>
  </g>
  <g fill="#0E6B30">
    <rect x="420" y="600" width="18" height="22" rx="2"/><rect x="446" y="600" width="18" height="22" rx="2"/>
    <rect x="632" y="600" width="18" height="22" rx="2"/><rect x="658" y="600" width="18" height="22" rx="2"/>
    <rect x="512" y="602" width="28" height="44" rx="3"/><rect x="556" y="602" width="28" height="44" rx="3"/>
    <rect x="508" y="560" width="80" height="10" rx="4"/>
  </g>
  <!-- wheels -->
  <circle cx="440" cy="770" r="40" fill="#0E6B30"/><circle cx="440" cy="770" r="15" fill="#22B04B"/>
  <circle cx="660" cy="770" r="40" fill="#0E6B30"/><circle cx="660" cy="770" r="15" fill="#22B04B"/>
</g>
</g>'
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
