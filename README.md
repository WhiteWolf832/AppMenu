# AppMenu

A GNOME Shell extension that adds **one or more configurable application
menus** to the panel, designed to sit alongside the Zorin OS taskbar menu
(but works on any GNOME Shell 45+ setup).

Each menu shows up as its own button with a chosen icon. Clicking opens a
popup listing the apps the user has assigned to it. Right-clicking opens
a small context menu with a shortcut to the preferences window.

---

## Features

- **Multiple independent menus** — group apps however you like (Dev,
  Media, Games…), each with its own icon in the panel.
- **Configurable app list per menu** — pick from any installed `.desktop`
  application, reorder with up/down arrows, remove with one click.
- **Visual icon picker** — searchable grid of every icon in the current
  GTK icon theme, with a "symbolic only" toggle.
- **Left vs. right click** — left opens the app menu, right opens
  *Preferences…* directly.
- **Translations** — English (source), French, German, Italian, Spanish,
  Portuguese.
- **Live updates** — newly installed apps appear in the menu automatically
  via the `Shell.AppSystem::installed-changed` signal.
- **Built for Zorin Taskbar / dash-to-panel** — the buttons land in the
  left panel box at index 1, immediately after the Zorin / Activities
  button. Works in vanilla GNOME too.

---

## Requirements

- GNOME Shell **45, 46, or 47** (ES module-based extensions)
- `glib-compile-schemas` (from `libglib2.0-bin`)
- `python3` (for the bundled `tools/po2mo.py` translation compiler)
- `rsync`

No need for `gettext` — translations are compiled with a pure-Python
implementation of `msgfmt`, so the build runs without root.

---

## Installation

```bash
git clone https://github.com/WhiteWolf832/AppMenu.git
cd AppMenu
./install.sh
```

Then reload GNOME Shell:

- **X11**: `Alt+F2`, type `r`, press `Enter`
- **Wayland**: log out and back in

Enable and open the preferences:

```bash
gnome-extensions enable appmenu@whitewolf.xaz.li
gnome-extensions prefs appmenu@whitewolf.xaz.li
```

---

## Usage

Open the preferences window. Click the **+** button in the *Panel menus*
header to create a new menu, then expand it to:

- rename the menu,
- pick an icon,
- add applications from the installed apps list.

The button(s) in the panel update live as you save — no need to reload
the Shell between changes.

---

## Architecture

```
AppMenu/
├── appmenu@whitewolf.xaz.li/    Extension bundle
│   ├── extension.js             Panel buttons + popup menus
│   ├── prefs.js                 Adwaita preferences window
│   ├── stylesheet.css           Shell stylesheet (panel icon size)
│   ├── metadata.json            UUID, supported shell versions
│   └── schemas/                 GSettings schema source
├── po/                          Translation sources (.pot + .po)
├── tools/po2mo.py               Pure-Python .po → .mo compiler
└── install.sh                   Build + install entry point
```

The user's menu configuration lives in a single GSettings key
(`org.gnome.shell.extensions.appmenu/menus`) as a JSON-encoded array,
which keeps the schema dead simple and makes import/export trivial via
`dconf dump` / `dconf load`.

---

## Building from source

`install.sh` does everything:

1. Compiles each `po/<lang>.po` into
   `appmenu@whitewolf.xaz.li/locale/<lang>/LC_MESSAGES/appmenu.mo`.
2. Compiles the GSettings schema with `glib-compile-schemas`.
3. Mirrors the bundle into `~/.local/share/gnome-shell/extensions/`
   with `rsync -a --delete`.

Re-run it after any change to source files.

---

## Contributing a translation

1. Copy `po/appmenu.pot` to `po/<lang>.po` (e.g. `nl.po`).
2. Edit the `Language:` and `Plural-Forms:` header fields.
3. Fill in each `msgstr` (and `msgstr[0]` / `msgstr[1]` for plurals).
4. Add the new language code to the `LOCALES=(…)` array in `install.sh`.
5. Run `./install.sh` and test with
   `LANGUAGE=<lang> gnome-extensions prefs appmenu@whitewolf.xaz.li`.

The `.pot` file includes translator-facing comments (`#.`) on every
string explaining where it appears and any constraints (e.g. "fits in a
button", "%d is a 1-based index").

> ⚠ `LANGUAGE` overrides `LANG` for gettext, so testing with just
> `LANG=de_DE.UTF-8` will *not* work if you have a different `LANGUAGE`
> set system-wide.

---

## License

[GPL-3.0-or-later](LICENSE) — same conventions as the rest of the GNOME
ecosystem.
