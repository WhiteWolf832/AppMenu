// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 WhiteWolf <whitewolf@xaz.li>

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

import {
    ExtensionPreferences,
    gettext as _,
    ngettext,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const DEFAULT_ICON = 'view-app-grid-symbolic';

export default class AppMenuPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(740, 820);

        const page = new Adw.PreferencesPage({
            title: _('Menus'),
            icon_name: 'view-app-grid-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Panel menus'),
            description: _('Each menu appears as a button next to the Zorin menu.'),
        });
        page.add(group);

        const addBtn = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: _('Add a menu'),
        });
        addBtn.connect('clicked', () => {
            const menus = this._loadMenus(settings);
            menus.push({
                id: GLib.uuid_string_random(),
                name: _('Menu %d').replace('%d', String(menus.length + 1)),
                iconName: DEFAULT_ICON,
                apps: [],
            });
            this._saveMenus(settings, menus);
            rebuildAll();
        });
        group.set_header_suffix(addBtn);

        const listBox = new Gtk.ListBox({
            css_classes: ['boxed-list'],
            selection_mode: Gtk.SelectionMode.NONE,
        });
        group.add(listBox);

        const rebuildAll = () => this._rebuildMenuList(window, listBox, settings);
        rebuildAll();
    }

    _loadMenus(settings) {
        try {
            return JSON.parse(settings.get_string('menus') || '[]');
        } catch (e) {
            return [];
        }
    }

    _saveMenus(settings, menus) {
        settings.set_string('menus', JSON.stringify(menus));
    }

    _updateMenu(settings, id, transform) {
        const menus = this._loadMenus(settings);
        const idx = menus.findIndex(m => m.id === id);
        if (idx < 0)
            return null;
        menus[idx] = transform(menus[idx]);
        this._saveMenus(settings, menus);
        return menus[idx];
    }

    _rebuildMenuList(window, listBox, settings) {
        let row = listBox.get_first_child();
        while (row) {
            const next = row.get_next_sibling();
            listBox.remove(row);
            row = next;
        }

        const menus = this._loadMenus(settings);

        if (menus.length === 0) {
            const empty = new Adw.ActionRow({
                title: _('No menu'),
                subtitle: _('Click + to create a menu.'),
            });
            listBox.append(empty);
            return;
        }

        const rebuildAll = () => this._rebuildMenuList(window, listBox, settings);

        menus.forEach((menu, index) => {
            const row = this._buildMenuRow(window, settings, menu, index, menus.length, rebuildAll);
            listBox.append(row);
        });
    }

    _buildMenuRow(window, settings, menu, index, totalMenus, rebuildAll) {
        const expander = new Adw.ExpanderRow({
            title: escapeMarkup(menu.name || _('Menu')),
        });

        const headerIcon = new Gtk.Image({
            icon_name: menu.iconName || DEFAULT_ICON,
            pixel_size: 28,
        });
        expander.add_prefix(headerIcon);

        const upBtn = new Gtk.Button({
            icon_name: 'go-up-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            sensitive: index > 0,
            tooltip_text: _('Move up'),
        });
        upBtn.connect('clicked', () => {
            const menus = this._loadMenus(settings);
            [menus[index - 1], menus[index]] = [menus[index], menus[index - 1]];
            this._saveMenus(settings, menus);
            rebuildAll();
        });
        expander.add_suffix(upBtn);

        const downBtn = new Gtk.Button({
            icon_name: 'go-down-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            sensitive: index < totalMenus - 1,
            tooltip_text: _('Move down'),
        });
        downBtn.connect('clicked', () => {
            const menus = this._loadMenus(settings);
            [menus[index + 1], menus[index]] = [menus[index], menus[index + 1]];
            this._saveMenus(settings, menus);
            rebuildAll();
        });
        expander.add_suffix(downBtn);

        const delBtn = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: _('Delete this menu'),
        });
        delBtn.connect('clicked', () => {
            const menus = this._loadMenus(settings).filter(m => m.id !== menu.id);
            this._saveMenus(settings, menus);
            rebuildAll();
        });
        expander.add_suffix(delBtn);

        // Rename in place rather than rebuilding so the expander stays open.
        const nameRow = new Adw.EntryRow({
            title: _('Name'),
            text: menu.name || '',
        });
        nameRow.connect('changed', () => {
            const newName = nameRow.get_text();
            this._updateMenu(settings, menu.id, m => ({ ...m, name: newName }));
            expander.title = escapeMarkup(newName || _('Menu'));
        });
        expander.add_row(nameRow);

        const iconRow = new Adw.ActionRow({
            title: _('Icon'),
            subtitle: menu.iconName || DEFAULT_ICON,
            activatable: true,
        });
        const iconPreview = new Gtk.Image({
            icon_name: menu.iconName || DEFAULT_ICON,
            pixel_size: 32,
        });
        iconRow.add_prefix(iconPreview);
        const changeIconBtn = new Gtk.Button({
            label: _('Choose…'),
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        iconRow.add_suffix(changeIconBtn);
        const onIconPicked = (name) => {
            this._updateMenu(settings, menu.id, m => ({ ...m, iconName: name }));
            iconRow.set_subtitle(name);
            iconPreview.icon_name = name;
            headerIcon.icon_name = name;
        };
        const openIconChooser = () => this._showIconChooser(window, onIconPicked);
        changeIconBtn.connect('clicked', openIconChooser);
        iconRow.connect('activated', openIconChooser);
        expander.add_row(iconRow);

        const appsHeader = new Adw.ActionRow({
            title: _('Applications'),
            subtitle: this._appsCountLabel(menu),
            css_classes: ['heading'],
        });
        expander.add_row(appsHeader);

        // Tracked so refreshApps() can remove the previous app rows.
        const appRows = [];

        const refreshApps = () => {
            for (const r of appRows)
                expander.remove(r);
            appRows.length = 0;

            const current = this._loadMenus(settings).find(m => m.id === menu.id);
            if (!current)
                return;

            (current.apps || []).forEach((appId, appIndex) => {
                const appInfo = Gio.DesktopAppInfo.new(appId);
                const row = new Adw.ActionRow({
                    title: escapeMarkup(appInfo ? appInfo.get_name() : appId),
                    subtitle: appInfo
                        ? escapeMarkup(appInfo.get_description() || '')
                        : _('Application not found'),
                });

                const icon = new Gtk.Image({ pixel_size: 28 });
                if (appInfo)
                    icon.gicon = appInfo.get_icon();
                else
                    icon.icon_name = 'image-missing-symbolic';
                row.add_prefix(icon);

                const upAppBtn = new Gtk.Button({
                    icon_name: 'go-up-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    sensitive: appIndex > 0,
                });
                upAppBtn.connect('clicked', () => {
                    this._updateMenu(settings, menu.id, m => {
                        const apps = [...(m.apps || [])];
                        [apps[appIndex - 1], apps[appIndex]] = [apps[appIndex], apps[appIndex - 1]];
                        return { ...m, apps };
                    });
                    refreshApps();
                });
                row.add_suffix(upAppBtn);

                const downAppBtn = new Gtk.Button({
                    icon_name: 'go-down-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    sensitive: appIndex < (current.apps || []).length - 1,
                });
                downAppBtn.connect('clicked', () => {
                    this._updateMenu(settings, menu.id, m => {
                        const apps = [...(m.apps || [])];
                        [apps[appIndex + 1], apps[appIndex]] = [apps[appIndex], apps[appIndex + 1]];
                        return { ...m, apps };
                    });
                    refreshApps();
                });
                row.add_suffix(downAppBtn);

                const removeAppBtn = new Gtk.Button({
                    icon_name: 'user-trash-symbolic',
                    valign: Gtk.Align.CENTER,
                    css_classes: ['flat'],
                    tooltip_text: _('Remove'),
                });
                removeAppBtn.connect('clicked', () => {
                    this._updateMenu(settings, menu.id, m => ({
                        ...m,
                        apps: (m.apps || []).filter((_app, i) => i !== appIndex),
                    }));
                    refreshApps();
                    const updated = this._loadMenus(settings).find(m => m.id === menu.id);
                    if (updated) appsHeader.set_subtitle(this._appsCountLabel(updated));
                });
                row.add_suffix(removeAppBtn);

                expander.add_row(row);
                appRows.push(row);
            });

            const addRow = new Adw.ActionRow({
                title: _('Add an application…'),
                activatable: true,
            });
            const plusIcon = new Gtk.Image({
                icon_name: 'list-add-symbolic',
                pixel_size: 16,
            });
            addRow.add_prefix(plusIcon);
            addRow.connect('activated', () => {
                this._showAppChooser(window, settings, menu.id, () => {
                    refreshApps();
                    const updated = this._loadMenus(settings).find(m => m.id === menu.id);
                    if (updated) appsHeader.set_subtitle(this._appsCountLabel(updated));
                });
            });
            expander.add_row(addRow);
            appRows.push(addRow);
        };

        refreshApps();

        return expander;
    }

    _appsCountLabel(menu) {
        const count = (menu.apps || []).length;
        if (count === 0) return _('None');
        return ngettext('%d application', '%d applications', count).replace('%d', String(count));
    }

    _showAppChooser(parent, settings, menuId, onPicked) {
        const dialog = new Adw.Window({
            title: _('Add an application'),
            transient_for: parent,
            modal: true,
            default_width: 500,
            default_height: 600,
        });

        const toolbar = new Adw.ToolbarView();
        dialog.set_content(toolbar);

        const header = new Adw.HeaderBar();
        toolbar.add_top_bar(header);

        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: _('Search an application…'),
            hexpand: true,
        });
        const searchBar = new Gtk.SearchBar({
            child: searchEntry,
            search_mode_enabled: true,
            show_close_button: false,
        });
        searchBar.connect_entry(searchEntry);
        toolbar.add_top_bar(searchBar);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vexpand: true,
        });

        const listBox = new Gtk.ListBox({
            css_classes: ['boxed-list'],
            selection_mode: Gtk.SelectionMode.NONE,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        const currentMenu = this._loadMenus(settings).find(m => m.id === menuId);
        const currentIds = currentMenu ? (currentMenu.apps || []) : [];

        const allApps = Gio.AppInfo.get_all()
            .filter(app => app.should_show() && !currentIds.includes(app.get_id()))
            .sort((a, b) => a.get_name().localeCompare(b.get_name()));

        const rows = [];
        for (const app of allApps) {
            const row = new Adw.ActionRow({
                title: escapeMarkup(app.get_name()),
                subtitle: app.get_description() ? escapeMarkup(app.get_description()) : '',
                activatable: true,
            });

            const icon = new Gtk.Image({
                gicon: app.get_icon(),
                pixel_size: 32,
            });
            row.add_prefix(icon);

            row.connect('activated', () => {
                this._updateMenu(settings, menuId, m => ({
                    ...m,
                    apps: [...(m.apps || []), app.get_id()],
                }));
                onPicked();
                dialog.close();
            });

            listBox.append(row);
            rows.push({
                row,
                name: app.get_name().toLowerCase(),
                desc: (app.get_description() || '').toLowerCase(),
            });
        }

        searchEntry.connect('search-changed', () => {
            const query = searchEntry.get_text().toLowerCase().trim();
            for (const r of rows)
                r.row.visible = !query || r.name.includes(query) || r.desc.includes(query);
        });

        scrolled.set_child(listBox);
        toolbar.set_content(scrolled);

        dialog.present();
        searchEntry.grab_focus();
    }

    _showIconChooser(parent, onPicked) {
        const dialog = new Adw.Window({
            title: _('Choose an icon'),
            transient_for: parent,
            modal: true,
            default_width: 640,
            default_height: 640,
        });

        const toolbar = new Adw.ToolbarView();
        dialog.set_content(toolbar);

        const header = new Adw.HeaderBar();
        const symbolicToggle = new Gtk.ToggleButton({
            icon_name: 'preferences-color-symbolic',
            tooltip_text: _('Symbolic icons only'),
            active: true,
        });
        header.pack_end(symbolicToggle);
        toolbar.add_top_bar(header);

        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: _('Search an icon…'),
            hexpand: true,
        });
        const searchBar = new Gtk.SearchBar({
            child: searchEntry,
            search_mode_enabled: true,
            show_close_button: false,
        });
        searchBar.connect_entry(searchEntry);
        toolbar.add_top_bar(searchBar);

        const countLabel = new Gtk.Label({
            label: '',
            margin_top: 6,
            margin_bottom: 6,
            css_classes: ['dim-label', 'caption'],
        });
        toolbar.add_top_bar(countLabel);

        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vexpand: true,
        });

        const flowBox = new Gtk.FlowBox({
            valign: Gtk.Align.START,
            selection_mode: Gtk.SelectionMode.NONE,
            homogeneous: true,
            max_children_per_line: 8,
            min_children_per_line: 4,
            column_spacing: 6,
            row_spacing: 6,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });
        scrolled.set_child(flowBox);
        toolbar.set_content(scrolled);

        const iconTheme = Gtk.IconTheme.get_for_display(parent.get_display());
        const allIcons = iconTheme.get_icon_names().sort();

        const MAX_RESULTS = 400;

        const buildList = () => {
            let child = flowBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                flowBox.remove(child);
                child = next;
            }

            const query = searchEntry.get_text().toLowerCase().trim();
            const symbolicOnly = symbolicToggle.active;

            const filtered = allIcons.filter(name => {
                if (symbolicOnly && !name.endsWith('-symbolic'))
                    return false;
                if (query && !name.toLowerCase().includes(query))
                    return false;
                return true;
            });

            const display = filtered.slice(0, MAX_RESULTS);

            if (filtered.length === 0) {
                countLabel.label = _('No icon found');
            } else if (filtered.length > MAX_RESULTS) {
                countLabel.label = _('%1$d shown out of %2$d — refine your search')
                    .replace('%1$d', String(display.length))
                    .replace('%2$d', String(filtered.length));
            } else {
                countLabel.label = ngettext('%d icon', '%d icons', filtered.length)
                    .replace('%d', String(filtered.length));
            }

            for (const name of display) {
                const btn = new Gtk.Button({
                    css_classes: ['flat'],
                    tooltip_text: name,
                });
                const box = new Gtk.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 4,
                    margin_top: 4,
                    margin_bottom: 4,
                });
                const icon = new Gtk.Image({
                    icon_name: name,
                    pixel_size: 32,
                });
                const label = new Gtk.Label({
                    label: name.replace(/-symbolic$/, ''),
                    ellipsize: Pango.EllipsizeMode.END,
                    max_width_chars: 12,
                    css_classes: ['caption'],
                });
                box.append(icon);
                box.append(label);
                btn.set_child(box);
                btn.connect('clicked', () => {
                    onPicked(name);
                    dialog.close();
                });
                flowBox.insert(btn, -1);
            }
        };

        searchEntry.connect('search-changed', buildList);
        symbolicToggle.connect('toggled', buildList);

        buildList();
        dialog.present();
        searchEntry.grab_focus();
    }
}

// Adw.ActionRow titles/subtitles use Pango markup, so escape user text.
function escapeMarkup(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
