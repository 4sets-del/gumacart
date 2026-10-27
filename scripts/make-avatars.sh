#!/bin/sh
# Letter avatars for push notifications from people without a profile photo
# (functions/index.js → photoOf). One PNG per app accent color and initial:
# hosting/avatars/<color index>/<A-Z, 0-9 or other>.png. The colors must
# match ACCENTS in constants/theme.js. Run from the project root.
set -e
FONT=node_modules/@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf
OUT=hosting/avatars
i=0
for color in '#16A34A' '#F59E0B' '#2563EB' '#7C3AED' '#E11D48' '#0D9488' '#EA580C' '#DB2777'; do
  mkdir -p "$OUT/$i"
  for ch in A B C D E F G H I J K L M N O P Q R S T U V W X Y Z 0 1 2 3 4 5 6 7 8 9 other; do
    label=$ch; [ "$ch" = other ] && label='?'
    magick -size 192x192 xc:"$color" -font "$FONT" -pointsize 92 -fill white \
      -gravity center -annotate +0+6 "$label" -depth 8 -strip -define png:compression-level=9 "PNG24:$OUT/$i/$ch.png"
  done
  i=$((i + 1))
done
echo "Wrote $OUT"
