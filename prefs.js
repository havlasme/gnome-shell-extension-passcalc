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

const PassCalcPrefsWidget = new GObject.Class({
    UI_FILE: '/prefs.ui',

    Name: 'PassCalcPrefsWidget',
    GTypeName: 'PassCalcPrefsWidget',
    Extends: Gtk.Box,
    
    _init: function(params) {
        this.parent(params);

        this.orientation = Gtk.Orientation.HORIZONTAL;
        this._loadUiFile();
        this._buildWidget();
    },

    getSettings: function() {
        if (!this._settings) {
            this._loadSettings();
        }

        return this._settings;
    },

    onRecentDomainAdd: function() {
        let dialog = new Gtk.Dialog({
            title: _('Add recent domain'),
            transient_for: this.get_toplevel(),
            modal: true,
            resizable: false
        });

        // cancel button
        let btn = dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);

        // ok button
        let btn = dialog.add_button(Gtk.STOCK_OK, Gtk.ResponseType.OK);
        btn.set_can_default(true);
        btn.sensitive = false;
        dialog.set_default(btn);
        
        // domain entry
        let entry = new Gtk.Entry({
            activates_default: true,
            margin: 5
        });
        entry.connect('changed', Lang.bind(this, function() {
            btn.sensitive = (entry.get_text() != '');
        }));
        dialog.get_content_area().add(entry);

        // response action
        dialog.connect('response', Lang.bind(this, function(w, r) {
            if (r == Gtk.ResponseType.OK) {
                let domain = entry.get_text();
                this.addRecentDomain(domain);
            }
            
            dialog.destroy();
        }));
        
        dialog.show_all();
    },
    
    onRecentDomainKeypress: function(w, e) {
        let [success, keyval] = e.get_keyval();
        if (!success) {
            return;
        }

        switch (keyval) {
            case Gdk.KEY_Delete:
                this.onRecentDomainRemove();
                break;
        }
    },
    
    onRecentDomainRemove: function() {
        let [any, model, iter] = this._recentDomainTreeviewSelection.get_selected();
        if (!any) {
            return;
        }
        
        this.removeRecentDomain(this._recentDomainStore.get_value(iter, 0));
    },    
    
    onShortcutKeybindAccelCleared: function(renderer, path) {
        this.updateShortcutKeybindStore(null);
        this.getSettings().set_strv(C.SETTINGS_SHORTCUT_KEYBIND, [ ]);
    },
    
    onShortcutKeybindAccelEdited: function(renderer, path, key, mods, hwcode) {
        let accel = Gtk.accelerator_name(key, mods);
        
        this.updateShortcutKeybindStore(accel);
        this.getSettings().set_strv(C.SETTINGS_SHORTCUT_KEYBIND, [ accel ]);
    },
    
    addRecentDomain: function(domain) {
        let current = this.getSettings().get_strv(C.SETTINGS_RECENT_DOMAINS);
        let index = current.indexOf(domain);
        
        if (index >= 0) {
            current.splice(index, 1);
        }
        
        current.unshift(domain);
        this.getSettings().set_strv(C.SETTINGS_RECENT_DOMAINS, current);
        this.updateRecentDomainStore(current);
    },
    
    removeRecentDomain: function(domain) {
        let current = this.getSettings().get_strv(C.SETTINGS_RECENT_DOMAINS);
        let index = current.indexOf(domain);
        
        if (index >= 0) {
            current.splice(index, 1);
            this.getSettings().set_strv(C.SETTINGS_RECENT_DOMAINS, current);
            this.updateRecentDomainStore(current);
        }
    },
    
    updateRecentDomainStore: function(list) {
        this._recentDomainStore.clear();
        
        for (let i=0,l=list.length; i<l; i++) {
            let iter = this._recentDomainStore.append();
            this._recentDomainStore.set(iter, [ 0 ], [ list[i] ]);
        }
    },
    
    updateShortcutKeybindStore: function(accel) {
        let [ key, mods ] = (accel != null) ? Gtk.accelerator_parse(accel) : [ 0, 0 ];
        this._shortcutKeybindStore.set(this._shortcutKeybindStoreIter, [ 0, 1 ], [ key, mods ]);
    },

    _buildWidget: function() {
        this.pack_start(this._mainBox, true, true, 0);

        // recent domain treeview
        let recentDomains = this.getSettings().get_strv(C.SETTINGS_RECENT_DOMAINS);
        this.updateRecentDomainStore(recentDomains);
        this._recentDomainTreeview.connect('key-release-event', Lang.bind(this, this.onRecentDomainKeypress));

        let renderer = new Gtk.CellRendererText();
        this._recentDomainTreeviewIdColumn.pack_start(renderer, true);
        this._recentDomainTreeviewIdColumn.add_attribute(renderer, 'text', 0);

        // recent domain add button
        this._recentDomainAdd.connect('clicked', Lang.bind(this, this.onRecentDomainAdd));

        // recent domain remove button
        this._recentDomainRemove.connect('clicked', Lang.bind(this, this.onRecentDomainRemove));

        // show copy notification switch
        this._showCopyNotificationSwitch.set_active(this.getSettings().get_boolean(C.SETTINGS_SHOW_NOTIFICATION));
        this._showCopyNotificationSwitch.connect('notify::active', Lang.bind(this, function(w) {
            this.getSettings().set_boolean(C.SETTINGS_SHOW_NOTIFICATION, w.active);
        }));

        // clipboard timeout entry
        this._clipboardTimeoutEntry.set_value(this.getSettings().get_int(C.SETTINGS_CLIPBOARD_TIMEOUT));
        this._clipboardTimeoutEntry.connect('notify::text', Lang.bind(this, function(w) {
            this.getSettings().set_int(C.SETTINGS_CLIPBOARD_TIMEOUT, this._clipboardTimeoutEntry.get_value_as_int());
        }));

        // maximum recent domains entry
        this._maxRecentDomainsEntry.set_value(this.getSettings().get_int(C.SETTINGS_RECENT_DOMAINS_MAXIMUM));
        this._maxRecentDomainsEntry.connect('notify::text', Lang.bind(this, function(w) {
            this.getSettings().set_int(C.SETTINGS_RECENT_DOMAINS_MAXIMUM, w.get_value_as_int());
        }));

        // shortcut keybind entry
        this._shortcutKeybindStoreIter = this._shortcutKeybindStore.append();
        let accel = this.getSettings().get_strv(C.SETTINGS_SHORTCUT_KEYBIND)[0];
        this.updateShortcutKeybindStore(accel);
        let renderer = new Gtk.CellRendererAccel({
            editable: true
        });
        renderer.connect('accel-cleared', Lang.bind(this, this.onShortcutKeybindAccelCleared));
        renderer.connect('accel-edited', Lang.bind(this, this.onShortcutKeybindAccelEdited));
        this._shortcutKeybindTreeviewColumn.pack_start(renderer, true);
        this._shortcutKeybindTreeviewColumn.add_attribute(renderer, 'accel-key', 0);
        this._shortcutKeybindTreeviewColumn.add_attribute(renderer, 'accel-mods', 1);

        // computation method combobox
        let iter = this._compMethodStore.append();
        this._compMethodStore.set(iter, [ 0, 1 ], [ E.COMP_METHOD.CONCAT, _('String concatenation') ]);
        let iter = this._compMethodStore.append();
        this._compMethodStore.set(iter, [ 0, 1 ], [ E.COMP_METHOD.KDF, _('Key derivation function') ]);
        let renderer = new Gtk.CellRendererText();
        this._compMethodCombo.pack_start(renderer, true);
        this._compMethodCombo.add_attribute(renderer, 'text', 1);
        this._compMethodCombo.set_active(this.getSettings().get_enum(C.SETTINGS_COMP_METHOD) - 1);
        this._compMethodCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success) {
                return;
            }

            let id = this._compMethodStore.get_value(iter, 0);
            this.getSettings().set_enum(C.SETTINGS_COMP_METHOD, id);

            switch (id) {
                case E.COMP_METHOD.CONCAT:
                    this._hashTypeCombo.set_sensitive(true);
                    this._kdfTypeCombo.set_sensitive(false);
                    break;
                case E.COMP_METHOD.KDF:
                    this._hashTypeCombo.set_sensitive(false);
                    this._kdfTypeCombo.set_sensitive(true);
                    break;
                default:
                    this._hashTypeCombo.set_sensitive(false);
                    this._kdfTypeCombo.set_sensitive(false);
                    break;
            }
        }));

        // string concatenation hash type combobox
        let iter = this._hashTypeStore.append();
        this._hashTypeStore.set(iter, [ 0, 1 ], [ E.HASH_TYPE.SHA256, _('SHA-256') ]);
        let iter = this._hashTypeStore.append();
        this._hashTypeStore.set(iter, [ 0, 1 ], [ E.HASH_TYPE.SHA512, _('SHA-512') ]);
        let renderer = new Gtk.CellRendererText();
        this._hashTypeCombo.pack_start(renderer, true);
        this._hashTypeCombo.add_attribute(renderer, 'text', 1);
        this._hashTypeCombo.set_active(this.getSettings().get_enum(C.SETTINGS_HASH_TYPE)-1);
        this._hashTypeCombo.set_sensitive((this.getSettings().get_enum(C.SETTINGS_COMP_METHOD) == E.COMP_METHOD.CONCAT));
        this._hashTypeCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success) {
                return;
            }

            let id = this._hashTypeStore.get_value(iter, 0);
            this.getSettings().set_enum(C.SETTINGS_HASH_TYPE, id);
        }));

        // key derivation function combobox
        let iter = this._kdfTypeStore.append();
        this._kdfTypeStore.set(iter, [ 0, 1 ], [ E.KDF_TYPE.HKDF_SHA256, _('HKDF (SHA-256)') ]);
        let iter = this._kdfTypeStore.append();
        this._kdfTypeStore.set(iter, [ 0, 1 ], [ E.KDF_TYPE.HKDF_SHA512, _('HKDF (SHA-512)') ]);
        let renderer = new Gtk.CellRendererText();
        this._kdfTypeCombo.pack_start(renderer, true);
        this._kdfTypeCombo.add_attribute(renderer, 'text', 1);
        this._kdfTypeCombo.set_active(this.getSettings().get_enum(C.SETTINGS_KDF_TYPE)-1);
        this._kdfTypeCombo.set_sensitive((this.getSettings().get_enum(C.SETTINGS_COMP_METHOD) == E.COMP_METHOD.KDF));
        this._kdfTypeCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success) {
                return;
            }

            let id = this._kdfTypeStore.get_value(iter, 0);
            this.getSettings().set_enum(C.SETTINGS_KDF_TYPE, id);
        }));

        // password length entry
        this._passwordLengthEntry.set_value(this.getSettings().get_int(C.SETTINGS_PASSWORD_LENGTH));
        this._passwordLengthEntry.connect('notify::text', Lang.bind(this, function(w) {
            this.getSettings().set_int(C.SETTINGS_PASSWORD_LENGTH, w.get_value_as_int());
        }));

        // password salt entry
        this._passwordSaltEntry.set_text(this.getSettings().get_string(C.SETTINGS_PASSWORD_SALT));
        this._passwordSaltEntry.connect('notify::text', Lang.bind(this, function(w) {
            this.getSettings().set_string(C.SETTINGS_PASSWORD_SALT, w.get_text());
        }));

        // remove lower alpha checkbox
        this.getSettings().bind(C.SETTINGS_REMOVE_LOWER_ALPHA, this._removeLowerAlphaCheck, 'active', Gio.SettingsBindFlags.DEFAULT);

        // remove upper alpha checkbox
        this.getSettings().bind(C.SETTINGS_REMOVE_UPPER_ALPHA, this._removeUpperAlphaCheck, 'active', Gio.SettingsBindFlags.DEFAULT);

        // remove numbers checkbox
        this.getSettings().bind(C.SETTINGS_REMOVE_NUMERIC, this._removeNumericCheck, 'active', Gio.SettingsBindFlags.DEFAULT);

        // remove symbols checkbox
        this.getSettings().bind(C.SETTINGS_REMOVE_SYMBOLS, this._removeSymbolsCheck, 'active', Gio.SettingsBindFlags.DEFAULT);
    },

    _loadSettings: function() {
        this._settings = Convenience.getSettings();
    },

    _loadUiFile: function() {
        let uiFile = Me.path + this.UI_FILE;

        this._uiBuilder = new Gtk.Builder();
        if (this._uiBuilder.add_from_file(uiFile) == 0) {
            log('could not load the ui file: %s'.format(uiFile));
            return;
        }

        this._mainBox = this._uiBuilder.get_object('main-box');
        this._showCopyNotificationSwitch = this._uiBuilder.get_object('show-copy-notification-switch');
        this._shortcutKeybindTreeviewColumn = this._uiBuilder.get_object('shortcut-keybind-treeview-column');
        this._shortcutKeybindStore = this._uiBuilder.get_object('shortcut-keybind-store');
        this._shortcutKeybindTreeview = this._uiBuilder.get_object('shortcut-keybind-treeview');
        this._clipboardTimeoutEntry = this._uiBuilder.get_object('clipboard-timeout-entry');
        this._maxRecentDomainsEntry = this._uiBuilder.get_object('max-recent-domains-entry');
        this._compMethodStore = this._uiBuilder.get_object('comp-method-store');
        this._compMethodCombo = this._uiBuilder.get_object('comp-method-combo');
        this._hashTypeStore = this._uiBuilder.get_object('hash-type-store');
        this._hashTypeCombo = this._uiBuilder.get_object('hash-type-combo');
        this._kdfTypeStore = this._uiBuilder.get_object('kdf-type-store');
        this._kdfTypeCombo = this._uiBuilder.get_object('kdf-type-combo');
        this._passwordLengthEntry = this._uiBuilder.get_object('password-length-entry');
        this._passwordSaltEntry = this._uiBuilder.get_object('password-salt-entry');
        this._removeLowerAlphaCheck = this._uiBuilder.get_object('remove-lower-alpha-check');
        this._removeUpperAlphaCheck = this._uiBuilder.get_object('remove-upper-alpha-check');
        this._removeNumericCheck = this._uiBuilder.get_object('remove-numeric-check');
        this._removeSymbolsCheck = this._uiBuilder.get_object('remove-symbols-check');
        this._recentDomainStore = this._uiBuilder.get_object('recent-domains-store');
        this._recentDomainTreeview = this._uiBuilder.get_object('recent-domains-treeview');
        this._recentDomainTreeviewSelection = this._uiBuilder.get_object('recent-domains-treeview-selection');
        this._recentDomainTreeviewIdColumn = this._uiBuilder.get_object('recent-domains-treeview-id-column');
        this._recentDomainAdd = this._uiBuilder.get_object('recent-domains-add');
        this._recentDomainRemove = this._uiBuilder.get_object('recent-domains-remove');
    }
});

function init() {
}

function buildPrefsWidget() {
    let widget = new PassCalcPrefsWidget();
    widget.show_all();

    return widget;
}
