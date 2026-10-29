#!/usr/bin/env bash
# Turns OpenTick's Tauri .deb into the contents of the snap: unpacks it, makes sure the desktop entry and icon are where snapd expects them.
#   assemble.sh <opentick.deb> <install dir> [fallback icon.png]
# Used by snap/snapcraft.yaml (which builds the .deb itself) and snap/ci/snapcraft.yaml (which is handed the .deb the desktop workflow already built).
set -euo pipefail

DEB="${1:?usage: assemble.sh <opentick.deb> <install dir> [fallback icon.png]}"
INSTALL="${2:?usage: assemble.sh <opentick.deb> <install dir> [fallback icon.png]}"
FALLBACK_ICON="${3:-}"

[ -f "$DEB" ] || { echo "ERROR: Debian package not found: $DEB"; exit 1; }
dpkg-deb -x "$DEB" "$INSTALL"

APP_BIN="$INSTALL/usr/bin/opentick"
APPS_DIR="$INSTALL/usr/share/applications"
DESKTOP_DEST="$APPS_DIR/opentick.desktop"

if [ ! -f "$APP_BIN" ]; then
  echo "ERROR: Expected executable was not found: $APP_BIN"
  find "$INSTALL/usr" -type f -executable -print || true
  exit 1
fi
chmod 0755 "$APP_BIN"

mkdir -p "$APPS_DIR"
DESKTOP_SOURCE="$(find "$APPS_DIR" -maxdepth 1 -type f -name '*.desktop' -print -quit 2>/dev/null || true)"
if [ -n "$DESKTOP_SOURCE" ]; then
  [ "$DESKTOP_SOURCE" = "$DESKTOP_DEST" ] || mv "$DESKTOP_SOURCE" "$DESKTOP_DEST"
else
  echo "No desktop entry was generated; creating one."
  cat > "$DESKTOP_DEST" <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=OpenTick
Comment=Open-source task manager
Exec=opentick
Icon=opentick
Terminal=false
Categories=Office;Utility;
StartupNotify=true
DESKTOP
fi

ICON_ROOT="$INSTALL/usr/share/icons/hicolor"
ICON="$(find "$ICON_ROOT/32x32/apps" -maxdepth 1 -type f \( -iname '*.png' -o -iname '*.svg' \) -print -quit 2>/dev/null || true)"
[ -n "$ICON" ] || ICON="$(find "$ICON_ROOT" -type f \( -iname '*.png' -o -iname '*.svg' \) -print -quit 2>/dev/null || true)"
if [ -z "$ICON" ] && [ -n "$FALLBACK_ICON" ] && [ -f "$FALLBACK_ICON" ]; then
  mkdir -p "$ICON_ROOT/128x128/apps"
  cp "$FALLBACK_ICON" "$ICON_ROOT/128x128/apps/opentick.png"
  ICON="$ICON_ROOT/128x128/apps/opentick.png"
fi
[ -n "$ICON" ] || { echo "ERROR: No usable application icon was found."; exit 1; }
ICON_PATH="${ICON#"$INSTALL"}"

if grep -q '^Exec=' "$DESKTOP_DEST"; then sed -i 's|^Exec=.*|Exec=opentick|' "$DESKTOP_DEST"; else printf '\nExec=opentick\n' >> "$DESKTOP_DEST"; fi
if grep -q '^Icon=' "$DESKTOP_DEST"; then sed -i "s|^Icon=.*|Icon=$ICON_PATH|" "$DESKTOP_DEST"; else printf '\nIcon=%s\n' "$ICON_PATH" >> "$DESKTOP_DEST"; fi

echo "Prepared executable: $APP_BIN"
echo "Prepared desktop entry: $DESKTOP_DEST"
echo "Prepared icon: $ICON_PATH"
