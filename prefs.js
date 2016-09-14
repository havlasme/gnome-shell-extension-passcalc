/**
    Copyright (C) 2015 Tomáš Havlas <tomashavlas@raven-systems.eu>
    Copyright (C) 2013 Thilo Maurer <maurer.thilo@gmail.com>
    Copyright (C) 2012 Stéphane Démurget <stephane.demurget@free.fr>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extension-passcalc');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const C = Me.imports.config;
const E = Me.imports.enum;

const PassCalcSettingsWidget = new GObject.Class({
    Name: 'PassCalcSettingsWidget',
    GTypeName: 'PassCalcSettingsWidget',
    Extends: Gtk.Box,
    
    _init: function(params) {
        this.parent(params);
        this.orientation = Gtk.Orientation.HORIZONTAL;
        this._settings = Convenience.getSettings();
        
        let uiFile = Me.path + '/prefs.ui';
        let uiBuilder = new Gtk.Builder();
        
        if (uiBuilder.add_from_file(uiFile) == 0) {
            log('could not load the ui file: %s'.format(uiFile));
            
            let label = new Gtk.Label({
                label: _('Could not load the preferences UI file.'),
                vexpand: true
            });
            
            this.pack_start(label, true, true, 0);
            return;
        }
        
        let mainBox = uiBuilder.get_object('main-box');
        let recentIdTreeviewIdColumn = uiBuilder.get_object('recent-id-treeview-id-column');
        let recentIdAdd = uiBuilder.get_object('recent-id-add');
        let recentIdRemove = uiBuilder.get_object('recent-id-remove');
        let clipboardTimeoutEntry = uiBuilder.get_object('clipboard-timeout-entry');
        let showCopyNotificationSwitch = uiBuilder.get_object('show-copy-notification-switch');
        let maxRecentIdsEntry = uiBuilder.get_object('max-recent-ids-entry');
        let shortcutKeybindTreeviewColumn = uiBuilder.get_object('shortcut-keybind-treeview-column');
        let passwordLengthEntry = uiBuilder.get_object('password-length-entry');
        let passwordSaltEntry = uiBuilder.get_object('password-salt-entry');
        let hashTypeStore = uiBuilder.get_object('hash-type-store');
        let hashTypeCombo = uiBuilder.get_object('hash-type-combo');
        let compMethodStore = uiBuilder.get_object('comp-method-store');
        let compMethodCombo = uiBuilder.get_object('comp-method-combo');
        let kdfTypeStore = uiBuilder.get_object('kdf-type-store');
        let kdfTypeCombo = uiBuilder.get_object('kdf-type-combo');
        let removeLowerAlphaCheck = uiBuilder.get_object('remove-lower-alpha-check');
        let removeUpperAlphaCheck = uiBuilder.get_object('remove-upper-alpha-check');
        let removeNumericCheck = uiBuilder.get_object('remove-numeric-check');
        let removeSymbolsCheck = uiBuilder.get_object('remove-symbols-check');
        this._recentIdStore = uiBuilder.get_object('recent-id-store');
        this._recentIdTreeview = uiBuilder.get_object('recent-id-treeview');
        this._recentIdTreeviewSelection = uiBuilder.get_object('recent-id-treeview-selection');
        this._shortcutKeybindStore = uiBuilder.get_object('shortcut-keybind-store');
        this._shortcutKeybindTreeview = uiBuilder.get_object('shortcut-keybind-treeview');
        
        this.pack_start(mainBox, true, true, 0);

        let renderer = new Gtk.CellRendererText();
        recentIdTreeviewIdColumn.pack_start(renderer, true);
        recentIdTreeviewIdColumn.add_attribute(renderer, 'text', 0);
        
        recentIdAdd.connect('clicked', Lang.bind(this, this._onRecentIdAdd));
        
        recentIdRemove.connect('clicked', Lang.bind(this, this._onRecentIdRemove));
        
        clipboardTimeoutEntry.set_value(this._settings.get_int(C.SETTINGS_CLIPBOARD_TIMEOUT));
        clipboardTimeoutEntry.connect('notify::text', Lang.bind(this, function(w) {
            this._settings.set_int(C.SETTINGS_CLIPBOARD_TIMEOUT, clipboardTimeoutEntry.get_value_as_int());
        }));
        
        showCopyNotificationSwitch.set_active(this._settings.get_boolean(C.SETTINGS_SHOW_NOTIFICATION));
        showCopyNotificationSwitch.connect('notify::active', Lang.bind(this, function(w) {
            this._settings.set_boolean(C.SETTINGS_SHOW_NOTIFICATION, w.active);
        }));
        
        maxRecentIdsEntry.set_value(this._settings.get_int(C.SETTINGS_RECENT_IDENTIFIERS_MAXIMUM));
        maxRecentIdsEntry.connect('notify::text', Lang.bind(this, function(w) {
            this._settings.set_int(C.SETTINGS_RECENT_IDENTIFIERS_MAXIMUM, w.get_value_as_int());
        }));      
        
        passwordLengthEntry.set_value(this._settings.get_int(C.SETTINGS_PASSWORD_LENGTH));
        passwordLengthEntry.connect('notify::text', Lang.bind(this, function(w) {
            this._settings.set_int(C.SETTINGS_PASSWORD_LENGTH, w.get_value_as_int());
        }));
        
        passwordSaltEntry.set_text(this._settings.get_string(C.SETTINGS_PASSWORD_SALT));
        passwordSaltEntry.connect('notify::text', Lang.bind(this, function(w) {
            this._settings.set_string(C.SETTINGS_PASSWORD_SALT, w.get_text());
        }));
        
        let iter = compMethodStore.append();
        compMethodStore.set(iter, [ 0, 1 ], [ E.COMP_METHOD.CONCAT, _('String concatenation') ]);
        let iter = compMethodStore.append();
        compMethodStore.set(iter, [ 0, 1 ], [ E.COMP_METHOD.KDF, _('Key derivation function') ]);
        let renderer = new Gtk.CellRendererText();
        compMethodCombo.pack_start(renderer, true);
        compMethodCombo.add_attribute(renderer, 'text', 1);
        compMethodCombo.set_active(this._settings.get_enum(C.SETTINGS_COMP_METHOD) - 1);
        compMethodCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success)
                return;

            let id = compMethodStore.get_value(iter, 0);
            this._settings.set_enum(C.SETTINGS_COMP_METHOD, id);
        }));

        let iter = hashTypeStore.append();
        hashTypeStore.set(iter, [ 0, 1 ], [ E.HASH_TYPE.SHA256, _('SHA-256') ]);
        let iter = hashTypeStore.append();
        hashTypeStore.set(iter, [ 0, 1 ], [ E.HASH_TYPE.SHA512, _('SHA-512') ]);
        let renderer = new Gtk.CellRendererText();
        hashTypeCombo.pack_start(renderer, true);
        hashTypeCombo.add_attribute(renderer, 'text', 1);
        hashTypeCombo.set_active(this._settings.get_enum(C.SETTINGS_HASH_TYPE)-1);
        hashTypeCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success)
                return;

            let id = hashTypeStore.get_value(iter, 0);
            this._settings.set_enum(C.SETTINGS_HASH_TYPE, id);
        }));
        
        let iter = kdfTypeStore.append();
        kdfTypeStore.set(iter, [ 0, 1 ], [ E.KDF_TYPE.HKDF_SHA256, _('HKDF (SHA-256)') ]);
        let iter = kdfTypeStore.append();
        kdfTypeStore.set(iter, [ 0, 1 ], [ E.KDF_TYPE.HKDF_SHA512, _('HKDF (SHA-512)') ]);
        let renderer = new Gtk.CellRendererText();
        kdfTypeCombo.pack_start(renderer, true);
        kdfTypeCombo.add_attribute(renderer, 'text', 1);
        kdfTypeCombo.set_active(this._settings.get_enum(C.SETTINGS_KDF_TYPE)-1);
        kdfTypeCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success)
                return;

            let id = kdfTypeStore.get_value(iter, 0);
            this._settings.set_enum(C.SETTINGS_KDF_TYPE, id);
        }));
        
        this._settings.bind(C.SETTINGS_REMOVE_LOWER_ALPHA, removeLowerAlphaCheck, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(C.SETTINGS_REMOVE_UPPER_ALPHA, removeUpperAlphaCheck, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(C.SETTINGS_REMOVE_NUMERIC, removeNumericCheck, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind(C.SETTINGS_REMOVE_SYMBOLS, removeSymbolsCheck, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        let recentIds = this._settings.get_strv(C.SETTINGS_RECENT_IDENTIFIERS);
        this.updateRecentIdStore(recentIds);
        
        this._recentIdTreeview.connect('key-release-event', Lang.bind(this, this._onRecentIdKeypress));
        
        this._shortcutKeybindStoreIter = this._shortcutKeybindStore.append();
        let accel = this._settings.get_strv(C.SETTINGS_SHORTCUT_KEYBIND)[0];
        this.updateShortcutKeybindStore(accel);
        let renderer = new Gtk.CellRendererAccel({
            editable: true
        });
        renderer.connect('accel-cleared', Lang.bind(this, this._onShortcutKeybindAccelCleared));
        renderer.connect('accel-edited', Lang.bind(this, this._onShortcutKeybindAccelEdited));
        shortcutKeybindTreeviewColumn.pack_start(renderer, true);
        shortcutKeybindTreeviewColumn.add_attribute(renderer, 'accel-key', 0);
        shortcutKeybindTreeviewColumn.add_attribute(renderer, 'accel-mods', 1);
    },
    
    _onRecentIdAdd: function() {
        let dialog = new Gtk.Dialog({
            title: _('Add recent identifier'),
            transient_for: this.get_toplevel(),
            modal: true,
            resizable: false
        });
        
        dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        let btn = dialog.add_button(Gtk.STOCK_OK, Gtk.ResponseType.OK);
        btn.set_can_default(true);
        btn.sensitive = false;
        dialog.set_default(btn);
        
        let entry = new Gtk.Entry({
            activates_default: true,
            margin: 5
        });
        entry.connect('changed', Lang.bind(this, function() {
            btn.sensitive = (entry.get_text() != '');
        }));
        dialog.get_content_area().add(entry);
        
        dialog.connect('response', Lang.bind(this, function(w, id) {
            if (id != Gtk.ResponseType.OK) {
                dialog.destroy();
                return;
            }
            
            let id = entry.get_text();
            this.storeRecentDomain(id);
            
            dialog.destroy();
        }));
        
        dialog.show_all();
    },
    
    _onRecentIdKeypress: function(w, e) {
        let [success, keyval] = e.get_keyval();
        if (!success)
            return;
            
        if (keyval == Gdk.KEY_Delete) {
            this._onRecentIdRemove();
        }
    },
    
    _onRecentIdRemove: function() {
        let [any, model, iter] = this._recentIdTreeviewSelection.get_selected();
        if (!any)
            return;
        
        this.removeRecentId(this._recentIdStore.get_value(iter, 0));
    },    
    
    _onShortcutKeybindAccelCleared: function(renderer, path) {
        this.updateShortcutKeybindStore(null);
        this._settings.set_strv(C.SETTINGS_SHORTCUT_KEYBIND, [ ]);
    },
    
    _onShortcutKeybindAccelEdited: function(renderer, path, key, mods, hwcode) {
        let accel = Gtk.accelerator_name(key, mods);
        
        this.updateShortcutKeybindStore(accel);
        this._settings.set_strv(C.SETTINGS_SHORTCUT_KEYBIND, [ accel ]);
    },
    
    addRecentId: function(id) {
        let current = this._settings.get_strv(C.SETTINGS_RECENT_IDENTIFIERS);
        let index = current.indexOf(id);
        
        if (index >= 0) {
            current.splice(index, 1);
        }
        
        current.unshift(id);
        this._settings.set_strv(C.SETTINGS_RECENT_IDENTIFIERS, current);
        this.updateRecentIdStore(current);
    },
    
    removeRecentId: function(id) {
        let current = this._settings.get_strv(C.SETTINGS_RECENT_IDENTIFIERS);
        let index = current.indexOf(id);
        
        if (index >= 0) {
            current.splice(index, 1);
            this._settings.set_strv(C.SETTINGS_RECENT_IDENTIFIERS, current);
            this.updateRecentIdStore(current);
        }
    },
    
    updateRecentIdStore: function(list) {
        this._recentIdStore.clear();
        
        for (let i=0,l=list.length; i<l; i++) {
            let iter = this._recentIdStore.append();
            this._recentIdStore.set(iter, [ 0 ], [ list[i] ]);
        }
    },
    
    updateShortcutKeybindStore: function(accel) {
        let [ key, mods ] = (accel != null) ? Gtk.accelerator_parse(accel) : [ 0, 0 ];
        this._shortcutKeybindStore.set(this._shortcutKeybindStoreIter, [ 0, 1 ], [ key, mods ]);
    }
});

function init() {
}

function buildPrefsWidget() {
    let widget = new PassCalcSettingsWidget();
    widget.show_all();

    return widget;
}
