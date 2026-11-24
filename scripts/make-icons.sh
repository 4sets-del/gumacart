#!/usr/bin/env bash
# Regenerates every app icon from scripts/logo.png (the team's logo: the
# SLSU cart on a dark green glossy tile, 480x480).
#   assets/icon.png                      app icon (the logo as is)
#   scripts/logo-emblem.png              the cart + ring cut out of the tile
#                                        (used here and by make-splash.sh)
#   assets/android-icon-background.png   adaptive icon background (dark green)
#   assets/android-icon-foreground.png   adaptive icon foreground (emblem)
#   assets/android-icon-monochrome.png   themed (one-color) icon
#   assets/notification-icon.png         status-bar icon (white silhouette)
#   assets/favicon.png, hosting/icon.png small copies
# Needs: ImageMagick 7 (magick), rsvg-convert.
# Run from the project root:  bash scripts/make-icons.sh   (then make-splash.sh)
set -euo pipefail
SRC=scripts/logo.png
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# App icon: the logo itself, enlarged to 1024.
magick "$SRC" -filter Lanczos -resize 1024x1024 -unsharp 0x1+0.5+0.02 -strip assets/icon.png

# Emblem: the inside of the tile, keeping only the bright cart and ring (the
# tile behind them is darker). The tile's glossy corners are masked off.
magick "$SRC" -crop 336x336+72+66 +repage -filter Lanczos -resize 1008x1008 "$TMP/crop.png"
magick "$TMP/crop.png" -colorspace HSL -channel L -separate +channel -level 40%,54% -fill black \
  -draw "polygon 0,0 380,0 0,300" -draw "polygon 708,0 1008,0 1008,250" \
  -draw "polygon 0,1008 0,800 200,1008" -draw "polygon 1008,1008 1008,800 808,1008" "$TMP/mask.png"
magick "$TMP/crop.png" "$TMP/mask.png" -alpha off -compose CopyOpacity -composite -strip scripts/logo-emblem.png

# Adaptive icon: Android crops a circle about 61% wide, so the emblem is smaller.
cat > "$TMP/bg.svg" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><radialGradient id="bg" cx="0.5" cy="0.4" r="0.75"><stop offset="0" stop-color="#2F6A40"/><stop offset="1" stop-color="#0C3E1B"/></radialGradient></defs>
<rect width="1024" height="1024" fill="url(#bg)"/></svg>
SVG
rsvg-convert -w 1024 -h 1024 "$TMP/bg.svg" -o assets/android-icon-background.png
magick -size 1024x1024 xc:none \( scripts/logo-emblem.png -resize 640x640 \) -gravity center -composite assets/android-icon-foreground.png
magick assets/android-icon-foreground.png -alpha extract "$TMP/a.png"
magick -size 1024x1024 xc:black "$TMP/a.png" -alpha off -compose CopyOpacity -composite assets/android-icon-monochrome.png

# Status-bar icon: white silhouette, 96 px.
magick -size 96x96 xc:white \( scripts/logo-emblem.png -alpha extract -resize 94x94 -level 25%,60% -background black -gravity center -extent 96x96 \) \
  -alpha off -compose CopyOpacity -composite assets/notification-icon.png

magick assets/icon.png -resize 48x48 assets/favicon.png
magick assets/icon.png -resize 256x256 hosting/icon.png
echo "Icons written to assets/, hosting/icon.png and scripts/logo-emblem.png"
