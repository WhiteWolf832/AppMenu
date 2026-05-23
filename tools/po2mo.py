#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
# SPDX-FileCopyrightText: 2026 WhiteWolf <whitewolf@xaz.li>
"""
Minimal pure-Python .po → .mo compiler.

Supports msgid / msgstr / msgid_plural / msgstr[N], string continuations,
basic escapes (\\n, \\t, \\\\, \\"). Doesn't support msgctxt or #~ fuzzy entries
(both are absent from our .po files).

Used because gettext-base on the system ships msgfmt's runtime but not the
compiler binary. Output format follows GNU gettext .mo spec.
"""
import os
import re
import struct
import sys


_ESCAPE_RE = re.compile(r'\\(.)')


def _unquote(s):
    if not (len(s) >= 2 and s[0] == '"' and s[-1] == '"'):
        raise ValueError(f"Expected quoted string, got: {s!r}")
    inner = s[1:-1]

    def replace(m):
        c = m.group(1)
        return {
            'n': '\n', 't': '\t', 'r': '\r',
            '\\': '\\', '"': '"',
        }.get(c, c)

    return _ESCAPE_RE.sub(replace, inner)


def parse_po(path):
    """Return list of (msgid, msgid_plural_or_None, [msgstr, msgstr_plural, ...])."""
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')

    entries = []
    msgid = None
    msgid_plural = None
    msgstrs = {}  # idx -> str (idx=0 if not plural)
    current = None  # ('msgid'|'msgid_plural'|'msgstr', idx)

    def flush():
        nonlocal msgid, msgid_plural, msgstrs
        if msgid is not None:
            entries.append((msgid, msgid_plural, dict(msgstrs)))
        msgid = None
        msgid_plural = None
        msgstrs = {}

    for raw in lines:
        line = raw.rstrip('\r')
        s = line.strip()

        if not s or s.startswith('#'):
            if not s and msgid is not None:
                flush()
            continue

        m = re.match(r'^(msgid|msgid_plural|msgstr)(?:\[(\d+)\])?\s+(".*")\s*$', s)
        if m:
            kw = m.group(1)
            idx = m.group(2)
            val = _unquote(m.group(3))
            if kw == 'msgid':
                if msgid is not None:
                    flush()
                msgid = val
                current = ('msgid', 0)
            elif kw == 'msgid_plural':
                msgid_plural = val
                current = ('msgid_plural', 0)
            else:  # msgstr
                key = int(idx) if idx is not None else 0
                msgstrs[key] = val
                current = ('msgstr', key)
        elif s.startswith('"'):
            val = _unquote(s)
            if current is None:
                continue
            kind, idx = current
            if kind == 'msgid':
                msgid += val
            elif kind == 'msgid_plural':
                msgid_plural += val
            elif kind == 'msgstr':
                msgstrs[idx] = msgstrs.get(idx, '') + val

    if msgid is not None:
        flush()

    return entries


def write_mo(entries, out_path):
    pairs = []  # (key_bytes, value_bytes)

    for msgid, msgid_plural, msgstrs in entries:
        if msgid_plural is not None:
            key = (msgid + '\0' + msgid_plural).encode('utf-8')
            ordered = [msgstrs[i] for i in sorted(msgstrs.keys())]
            if not all(ordered):
                continue  # skip empty plural translations
            value = '\0'.join(ordered).encode('utf-8')
            pairs.append((key, value))
        else:
            translation = msgstrs.get(0, '')
            # Always keep the empty msgid (metadata header), else skip empty translations
            if msgid == '' or translation:
                pairs.append((msgid.encode('utf-8'), translation.encode('utf-8')))

    pairs.sort(key=lambda x: x[0])
    n = len(pairs)

    # Header is 28 bytes; followed by two N x 8-byte index tables.
    keystart = 28 + 2 * n * 8

    key_table = []
    val_table = []
    string_blob = bytearray()
    offset = keystart

    for k, _v in pairs:
        key_table.append((len(k), offset))
        string_blob.extend(k)
        string_blob.append(0)
        offset += len(k) + 1

    for _k, v in pairs:
        val_table.append((len(v), offset))
        string_blob.extend(v)
        string_blob.append(0)
        offset += len(v) + 1

    header = struct.pack(
        '<IIIIIII',
        0x950412DE,   # magic
        0,            # version
        n,            # number of strings
        28,           # offset of msgid table
        28 + 8 * n,   # offset of msgstr table
        0,            # hash table size
        0,            # hash table offset
    )

    key_table_bytes = b''.join(struct.pack('<II', l, o) for l, o in key_table)
    val_table_bytes = b''.join(struct.pack('<II', l, o) for l, o in val_table)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'wb') as f:
        f.write(header)
        f.write(key_table_bytes)
        f.write(val_table_bytes)
        f.write(bytes(string_blob))


def main():
    if len(sys.argv) != 3:
        print("Usage: po2mo.py INPUT.po OUTPUT.mo", file=sys.stderr)
        sys.exit(2)
    entries = parse_po(sys.argv[1])
    write_mo(entries, sys.argv[2])
    print(f"✔ {sys.argv[1]} → {sys.argv[2]} ({len(entries)} entries)")


if __name__ == '__main__':
    main()
