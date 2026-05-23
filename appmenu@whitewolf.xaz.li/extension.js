// SPDX-License-Identifier: GPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 WhiteWolf <whitewolf@xaz.li>

import GObject from 'gi://GObject';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';

import {
    Extension,
    gettext as _,
} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const APP_ICON_SIZE = 22;
const PANEL_ICON_SIZE = 32;
const DEFAULT_ICON = 'view-app-grid-symbolic';

const AppMenuButton = GObject.registerClass(
class AppMenuButton extends PanelMenu.Button {
    _init(extension, menuConfig) {
        super._init(0.0, menuConfig.name || _('App Menu'));

        this._extension = extension;
        this._config = menuConfig;

        this._icon = new St.Icon({
            icon_name: menuConfig.iconName || DEFAULT_ICON,
            style_class: 'system-status-icon appmenu-panel-icon',
            icon_size: PANEL_ICON_SIZE,
        });
        this.add_child(this._icon);

        this._buildMenu();
    }

    updateConfig(menuConfig) {
        this._config = menuConfig;
        this._icon.icon_name = menuConfig.iconName || DEFAULT_ICON;
        this._buildMenu();
    }

    vfunc_event(event) {
        if (this.menu &&
            (event.type() === Clutter.EventType.BUTTON_PRESS ||
             event.type() === Clutter.EventType.TOUCH_BEGIN)) {
            const button = event.type() === Clutter.EventType.BUTTON_PRESS
                ? event.get_button()
                : 1;
            // Right-click shows the context menu; PanelMenu.Button only
            // opens on primary click, so we open it ourselves here.
            if (button === 3) {
                this._buildMenu({ contextMenu: true });
                this.menu.toggle();
                return Clutter.EVENT_STOP;
            }
            this._buildMenu({ contextMenu: false });
        }
        return super.vfunc_event(event);
    }

    _buildMenu({ contextMenu = false } = {}) {
        this.menu.removeAll();

        if (contextMenu) {
            const prefsItem = new PopupMenu.PopupMenuItem(_('Preferences…'));
            prefsItem.connect('activate', () => this._extension.openPreferences());
            this.menu.addMenuItem(prefsItem);
            return;
        }

        const appIds = this._config.apps || [];
        const appSystem = Shell.AppSystem.get_default();
        let added = 0;

        for (const appId of appIds) {
            const app = appSystem.lookup_app(appId);
            if (!app)
                continue;

            const item = new PopupMenu.PopupBaseMenuItem();

            const icon = app.create_icon_texture(APP_ICON_SIZE);
            icon.style_class = 'popup-menu-icon appmenu-app-icon';
            item.add_child(icon);

            item.add_child(new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style_class: 'appmenu-app-label',
            }));

            item.connect('activate', () => {
                app.activate();
                Main.overview.hide();
            });

            this.menu.addMenuItem(item);
            added++;
        }

        if (added === 0) {
            const empty = new PopupMenu.PopupMenuItem(_('No application configured'));
            empty.setSensitive(false);
            this.menu.addMenuItem(empty);
        }
    }
});

export default class AppMenuExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._buttons = new Map();

        this._rebuildButtons();

        this._settingsHandler = this._settings.connect('changed::menus',
            () => this._rebuildButtons());

        this._appSystemHandler = Shell.AppSystem.get_default().connect(
            'installed-changed',
            () => {
                for (const button of this._buttons.values())
                    button._buildMenu();
            });
    }

    disable() {
        if (this._settingsHandler) {
            this._settings.disconnect(this._settingsHandler);
            this._settingsHandler = null;
        }
        if (this._appSystemHandler) {
            Shell.AppSystem.get_default().disconnect(this._appSystemHandler);
            this._appSystemHandler = null;
        }
        for (const button of this._buttons.values())
            button.destroy();
        this._buttons.clear();
        this._buttons = null;
        this._settings = null;
    }

    _loadMenus() {
        try {
            return JSON.parse(this._settings.get_string('menus') || '[]');
        } catch (e) {
            logError(e, 'AppMenu: invalid menus setting');
            return [];
        }
    }

    _rebuildButtons() {
        const menus = this._loadMenus();
        const ids = new Set(menus.map(m => m.id));

        for (const [id, button] of this._buttons) {
            if (!ids.has(id)) {
                button.destroy();
                this._buttons.delete(id);
            }
        }

        // Index 0 in the left box is the Zorin/Activities button, so our
        // buttons start at 1 to sit just after it.
        menus.forEach((menu, index) => {
            const existing = this._buttons.get(menu.id);
            if (existing) {
                existing.updateConfig(menu);
            } else {
                const button = new AppMenuButton(this, menu);
                Main.panel.addToStatusArea(`${this.uuid}-${menu.id}`, button, 1 + index, 'left');
                this._buttons.set(menu.id, button);
            }
        });
    }
}
