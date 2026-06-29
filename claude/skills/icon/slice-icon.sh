#!/usr/bin/env bash
# slice-icon.sh — create/repair an App Icon so it actually shows on App Store Connect.
# The #1 reason icons vanish on ASC: the 1024 marketing icon has an alpha channel
# (Apple silently drops it). This flattens alpha, slices all sizes, and verifies.
#
# Usage:
#   slice-icon.sh <project-dir> [--source img.png] [--mac] [--check]
#
#   <project-dir>   project root containing an Assets.xcassets (searched recursively)
#   --source img    master image to use (>=1024). Default: existing 1024 in the set,
#                   else a generated gradient+glyph fallback.
#   --mac           also build/repair a macOS AppIcon (full 16->1024 size set)
#   --check         diagnose only: report hasAlpha for every 1024, change nothing
#
# Deterministic core. Shipping is handled separately by the `ship` / asc-xcode-build skills.
set -euo pipefail

die(){ echo "ERROR: $*" >&2; exit 1; }
command -v magick >/dev/null || die "ImageMagick (magick) not found"

PROJ="" SOURCE="" DO_MAC=0 CHECK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2;;
    --mac) DO_MAC=1; shift;;
    --check) CHECK=1; shift;;
    *) PROJ="$1"; shift;;
  esac
done
[ -n "$PROJ" ] && [ -d "$PROJ" ] || die "pass a valid project dir"

# locate iOS appiconset (the one NOT under a macOS/ path); fall back to first found
IOS_SET="" MAC_SET=""
while IFS= read -r s; do
  [ -n "$s" ] || continue
  case "$s" in *[mM]ac[oO][sS]*) MAC_SET="$s";; *) [ -z "$IOS_SET" ] && IOS_SET="$s";; esac
done < <(find "$PROJ" -type d -name AppIcon.appiconset 2>/dev/null)

# --- helpers -----------------------------------------------------------------
# flatten onto the icon's own corner colour so transparent corners don't go white
flatten(){ # in out
  local bg; bg=$(magick "$1" -format '%[pixel:p{0,0}]' info: 2>/dev/null || echo white)
  magick "$1" -background "$bg" -alpha remove -alpha off "$2"
}
has_alpha(){ sips -g hasAlpha "$1" 2>/dev/null | awk '/hasAlpha/{print $2}'; }
master_of(){ # find a 1024 png in a set
  find "$1" -maxdepth 1 -name '*.png' -exec sh -c 'sips -g pixelWidth "$1"|grep -q 1024' _ {} \; -print 2>/dev/null | head -1
}

resolve_master(){ # set-dir -> echoes path to a usable 1024 master (temp ok)
  local set="$1" m=""
  if [ -n "$SOURCE" ]; then m="$SOURCE"
  else m=$(master_of "$set"); fi
  if [ -z "$m" ]; then
    m="$(mktemp -t iconmaster).png"
    magick -size 1024x1024 radial-gradient:'#5B8DEF'-'#243B73' \
      -gravity center -pointsize 520 -fill white -font Helvetica-Bold \
      -annotate +0+0 "$(basename "$PROJ"|cut -c1|tr '[:lower:]' '[:upper:]')" "$m"
    echo "generated fallback icon (no source/existing icon found)" >&2
  fi
  echo "$m"
}

verify_no_alpha(){ # dir : abort if any 1024 still has alpha
  local bad=0
  while IFS= read -r f; do
    sips -g pixelWidth "$f" 2>/dev/null | grep -q 1024 || continue
    case "$f" in *tinted*) continue;; esac   # iOS tinted variant legitimately uses alpha
    if [ "$(has_alpha "$f")" = "yes" ]; then echo "  STILL HAS ALPHA: $f" >&2; bad=1; fi
  done < <(find "$1" -maxdepth 1 -name '*.png')
  [ "$bad" = 0 ] || die "alpha channel remains on a 1024 marketing icon — Apple will drop it"
}

report(){ # dir label
  echo "  [$2] $1"
  find "$1" -maxdepth 1 -name '*.png' | while IFS= read -r f; do
    printf "    %-22s %sx%s alpha=%s\n" "$(basename "$f")" \
      "$(sips -g pixelWidth "$f"|awk '/pixelWidth/{print $2}')" \
      "$(sips -g pixelHeight "$f"|awk '/pixelHeight/{print $2}')" "$(has_alpha "$f")"
  done
}

# --- check mode --------------------------------------------------------------
if [ "$CHECK" = 1 ]; then
  echo "== icon check: $PROJ =="
  [ -n "$IOS_SET" ] && report "$IOS_SET" iOS
  [ -n "$MAC_SET" ] && report "$MAC_SET" macOS
  [ -z "$IOS_SET$MAC_SET" ] && echo "  no AppIcon.appiconset found"
  exit 0
fi

# --- iOS: flatten every non-tinted png in place ------------------------------
if [ -n "$IOS_SET" ]; then
  echo "== iOS: $IOS_SET =="
  if [ -n "$SOURCE" ]; then
    flatten "$SOURCE" "$IOS_SET/AppIcon.png"
    echo "  wrote AppIcon.png from --source"
  fi
  for f in "$IOS_SET"/*.png; do
    case "$f" in *tinted*) continue;; esac      # keep tinted alpha
    [ "$(has_alpha "$f")" = "yes" ] || continue
    flatten "$f" "$f.flat" && mv "$f.flat" "$f"
    echo "  flattened $(basename "$f")"
  done
  verify_no_alpha "$IOS_SET"
fi

# --- macOS: full size set from a 1024 master --------------------------------
if [ "$DO_MAC" = 1 ]; then
  [ -n "$MAC_SET" ] || { MAC_SET="$PROJ/Assets.xcassets/AppIcon.appiconset"; mkdir -p "$MAC_SET"; }
  echo "== macOS: $MAC_SET =="
  M=$(resolve_master "${IOS_SET:-$MAC_SET}"); FM="$(mktemp -t iconmac).png"; flatten "$M" "$FM"
  : > "$MAC_SET/.imgs"
  emit(){ # px name
    sips -z "$1" "$1" "$FM" --out "$MAC_SET/$2" >/dev/null
    flatten "$MAC_SET/$2" "$MAC_SET/$2.f" && mv "$MAC_SET/$2.f" "$MAC_SET/$2"
  }
  emit 16 icon-16.png; emit 32 icon-32.png; emit 64 icon-64.png
  emit 128 icon-128.png; emit 256 icon-256.png; emit 512 icon-512.png; emit 1024 icon-1024.png
  cat > "$MAC_SET/Contents.json" <<'JSON'
{ "images" : [
  {"size":"16x16","idiom":"mac","filename":"icon-16.png","scale":"1x"},
  {"size":"16x16","idiom":"mac","filename":"icon-32.png","scale":"2x"},
  {"size":"32x32","idiom":"mac","filename":"icon-32.png","scale":"1x"},
  {"size":"32x32","idiom":"mac","filename":"icon-64.png","scale":"2x"},
  {"size":"128x128","idiom":"mac","filename":"icon-128.png","scale":"1x"},
  {"size":"128x128","idiom":"mac","filename":"icon-256.png","scale":"2x"},
  {"size":"256x256","idiom":"mac","filename":"icon-256.png","scale":"1x"},
  {"size":"256x256","idiom":"mac","filename":"icon-512.png","scale":"2x"},
  {"size":"512x512","idiom":"mac","filename":"icon-512.png","scale":"1x"},
  {"size":"512x512","idiom":"mac","filename":"icon-1024.png","scale":"2x"}
], "info" : { "author":"xcode", "version":1 } }
JSON
  rm -f "$MAC_SET/.imgs"
  verify_no_alpha "$MAC_SET"
fi

echo "OK — icons flattened & verified (no alpha on 1024). Next: rebuild + upload a NEW build"
echo "     (ASC only updates the icon from a freshly *processed* build)."
