#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 WhiteWolf <whitewolf@xaz.li>
#
# Build a redistributable .zip of the extension.
#
# Translations are pre-compiled into locale/ (the packer expects ready .mo
# files) using the bundled pure-Python tool, so no msgfmt is required. The
# locale/ tree is passed to `gnome-extensions pack` via --extra-source; the
# schema XML under schemas/ is picked up automatically.
#
# Output: dist/appmenu@whitewolf.xaz.li.shell-extension.zip
#
set -euo pipefail

UUID="appmenu@whitewolf.xaz.li"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${ROOT}/${UUID}"
OUT_DIR="${ROOT}/dist"
LOCALES=(fr de it es pt)

echo "→ Compiling translations into the bundle"
for lang in "${LOCALES[@]}"; do
    PO="${ROOT}/po/${lang}.po"
    MO_DIR="${SRC_DIR}/locale/${lang}/LC_MESSAGES"
    if [[ -f "${PO}" ]]; then
        mkdir -p "${MO_DIR}"
        python3 "${ROOT}/tools/po2mo.py" "${PO}" "${MO_DIR}/appmenu.mo" | sed 's/^/  /'
    fi
done

echo "→ Packing with gnome-extensions pack"
mkdir -p "${OUT_DIR}"
gnome-extensions pack --force \
    --extra-source=locale \
    --out-dir="${OUT_DIR}" \
    "${SRC_DIR}"

ZIP="${OUT_DIR}/${UUID}.shell-extension.zip"
echo
echo "✔ Package ready: ${ZIP}"
echo
echo "Bundle contents:"
unzip -l "${ZIP}" | awk 'NR>3 && $4 != "" && $1 != "---------" {print "  " $4}'
