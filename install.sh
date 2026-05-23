#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 WhiteWolf <whitewolf@xaz.li>
#
# Build & install the AppMenu GNOME Shell extension into the user's
# extensions directory. Self-contained: compiles .po → .mo with a Python
# tool (no msgfmt dependency) and the GSettings schema with glib-compile-
# schemas, then rsyncs the bundle into ~/.local/share/gnome-shell/extensions.
#
# Re-run safely: rsync --delete keeps the destination in sync with source.
#
set -euo pipefail

UUID="appmenu@whitewolf.xaz.li"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${ROOT}/${UUID}"
DEST_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

# Supported translation locales. Each one must have a corresponding
# po/<lang>.po file; the loop is silent if a file is missing.
LOCALES=(fr de it es pt)

if [[ ! -d "${SRC_DIR}" ]]; then
    echo "Error: source directory not found: ${SRC_DIR}" >&2
    exit 1
fi

# --- Translations: compile each .po into the extension's locale tree ---
echo "→ Compiling translations"
for lang in "${LOCALES[@]}"; do
    PO="${ROOT}/po/${lang}.po"
    MO_DIR="${SRC_DIR}/locale/${lang}/LC_MESSAGES"
    if [[ -f "${PO}" ]]; then
        mkdir -p "${MO_DIR}"
        python3 "${ROOT}/tools/po2mo.py" "${PO}" "${MO_DIR}/appmenu.mo" | sed 's/^/  /'
    fi
done

# --- GSettings schema: must be compiled into a binary cache ----------
echo "→ Compiling GSettings schema"
glib-compile-schemas "${SRC_DIR}/schemas/"

# --- Install: mirror source dir to user extensions dir ---------------
echo "→ Installing to ${DEST_DIR}"
mkdir -p "${DEST_DIR}"
rsync -a --delete "${SRC_DIR}/" "${DEST_DIR}/"

echo
echo "✔ Extension installed."
echo
echo "Next steps:"
echo "  1. Restart GNOME Shell:"
echo "       - On X11: Alt+F2, type 'r', press Enter"
echo "       - On Wayland: log out and back in"
echo "  2. Enable the extension:"
echo "       gnome-extensions enable ${UUID}"
echo "  3. Open the preferences:"
echo "       gnome-extensions prefs ${UUID}"
