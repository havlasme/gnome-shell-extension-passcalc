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
    Name: 'PassCalcPrefsWidget',
    GTypeName: 'PassCalcPrefsWidget',
    Extends: Gtk.Box,

    UI_FILE: '/ui/prefs.gtkbuilder',
    
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
        let recentDomainDialog = new Gtk.Dialog({
            title: _('Add recent domain'),
            modal: true,
            resizable: false,
            transient_for: this.get_toplevel()
        });

        // ok button
        let okButton = recentDomainDialog.add_button(Gtk.STOCK_OK, Gtk.ResponseType.OK);
        okButton.set_can_default(true);
        okButton.sensitive = false;
        recentDomainDialog.set_default(okButton);

        // cancel button
        let cancelButton = recentDomainDialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        
        // domain entry
        let domainEntry = new Gtk.Entry({
            activates_default: true,
            margin: 5
        });
        domainEntry.connect('changed', Lang.bind(this, function() {
            okButton.sensitive = (domainEntry.get_text() != '');
        }));
        recentDomainDialog.get_content_area().add(domainEntry);

        // response action
        recentDomainDialog.connect('response', Lang.bind(this, function(w, r) {
            if (r == Gtk.ResponseType.OK) {
                let domain = domainEntry.get_text();
                this.addRecentDomain(domain);
            }
            
            recentDomainDialog.destroy();
        }));
        
        recentDomainDialog.show_all();
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
        let [any, model, iter] = this._recentDomainsTreeviewSelection.get_selected();
        if (!any) {
            return;
        }
        
        this.removeRecentDomain(this._recentDomainsStore.get_value(iter, 0));
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
        this.updateRecentDomainsStore(current);
    },
    
    removeRecentDomain: function(domain) {
        let current = this.getSettings().get_strv(C.SETTINGS_RECENT_DOMAINS);
        let index = current.indexOf(domain);
        
        if (index >= 0) {
            current.splice(index, 1);
            this.getSettings().set_strv(C.SETTINGS_RECENT_DOMAINS, current);
            this.updateRecentDomainsStore(current);
        }
    },
    
    updateRecentDomainsStore: function(list) {
        this._recentDomainsStore.clear();
        
        for (let i=0,l=list.length; i<l; i++) {
            let iter = this._recentDomainsStore.append();
            this._recentDomainsStore.set(iter, [ 0 ], [ list[i] ]);
        }
    },
    
    updateShortcutKeybindStore: function(accel) {
        let [ key, mods ] = (accel != null) ? Gtk.accelerator_parse(accel) : [ 0, 0 ];
        this._shortcutKeybindStore.set(this._shortcutKeybindStoreIter, [ 0, 1 ], [ key, mods ]);
    },

    _adjustControls: function() {
        switch (this.getSettings().get_enum(C.SETTINGS_COMP_METHOD)) {
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
    },

    _buildWidget: function() {
        this.pack_start(this._mainBox, true, true, 0);

        // recent domain treeview
        let recentDomains = this.getSettings().get_strv(C.SETTINGS_RECENT_DOMAINS);
        this.updateRecentDomainsStore(recentDomains);
        this._recentDomainsTreeview.connect('key-release-event', Lang.bind(this, this.onRecentDomainKeypress));

        let recentDomainsRenderer = new Gtk.CellRendererText();
        this._recentDomainsTreeviewIdColumn.pack_start(recentDomainsRenderer, true);
        this._recentDomainsTreeviewIdColumn.add_attribute(recentDomainsRenderer, 'text', 0);

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
        let accelRenderer = new Gtk.CellRendererAccel({
            editable: true
        });
        accelRenderer.connect('accel-cleared', Lang.bind(this, this.onShortcutKeybindAccelCleared));
        accelRenderer.connect('accel-edited', Lang.bind(this, this.onShortcutKeybindAccelEdited));
        this._shortcutKeybindTreeviewColumn.pack_start(accelRenderer, true);
        this._shortcutKeybindTreeviewColumn.add_attribute(accelRenderer, 'accel-key', 0);
        this._shortcutKeybindTreeviewColumn.add_attribute(accelRenderer, 'accel-mods', 1);

        // computation method combobox
        let compMethodStoreIter = this._compMethodStore.append();
        this._compMethodStore.set(compMethodStoreIter, [ 0, 1 ], [ E.COMP_METHOD.CONCAT, _('String concatenation') ]);
        compMethodStoreIter = this._compMethodStore.append();
        this._compMethodStore.set(compMethodStoreIter, [ 0, 1 ], [ E.COMP_METHOD.KDF, _('Key derivation function') ]);
        let compMethodRenderer = new Gtk.CellRendererText();
        this._compMethodCombo.pack_start(compMethodRenderer, true);
        this._compMethodCombo.add_attribute(compMethodRenderer, 'text', 1);
        this._compMethodCombo.set_active_id(this.getSettings().get_enum(C.SETTINGS_COMP_METHOD).toString());
        this._compMethodCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success) {
                return;
            }

            let id = this._compMethodStore.get_value(iter, 0);
            this.getSettings().set_enum(C.SETTINGS_COMP_METHOD, id);

            this._adjustControls();
        }));

        // string concatenation hash type combobox
        let hashTypeStoreIter = this._hashTypeStore.append();
        this._hashTypeStore.set(hashTypeStoreIter, [ 0, 1 ], [ E.HASH_TYPE.SHA256, _('SHA-256') ]);
        hashTypeStoreIter = this._hashTypeStore.append();
        this._hashTypeStore.set(hashTypeStoreIter, [ 0, 1 ], [ E.HASH_TYPE.SHA512, _('SHA-512') ]);
        let hashTypeRenderer = new Gtk.CellRendererText();
        this._hashTypeCombo.pack_start(hashTypeRenderer, true);
        this._hashTypeCombo.add_attribute(hashTypeRenderer, 'text', 1);
        this._hashTypeCombo.set_active_id(this.getSettings().get_enum(C.SETTINGS_HASH_TYPE).toString());
        this._hashTypeCombo.connect('changed', Lang.bind(this, function(w) {
            let [success, iter] = w.get_active_iter();
            if (!success) {
                return;
            }

            let id = this._hashTypeStore.get_value(iter, 0);
            this.getSettings().set_enum(C.SETTINGS_HASH_TYPE, id);
        }));

        // key derivation function combobox
        let kdfTypeStoreIter = this._kdfTypeStore.append();
        this._kdfTypeStore.set(kdfTypeStoreIter, [ 0, 1 ], [ E.KDF_TYPE.HKDF_SHA256, _('HKDF-SHA256') ]);
        kdfTypeStoreIter = this._kdfTypeStore.append();
        this._kdfTypeStore.set(kdfTypeStoreIter, [ 0, 1 ], [ E.KDF_TYPE.HKDF_SHA512, _('HKDF-SHA512') ]);
        kdfTypeStoreIter = this._kdfTypeStore.append();
        this._kdfTypeStore.set(kdfTypeStoreIter, [ 0, 1 ], [ E.KDF_TYPE.PBKDF2_HMAC_SHA256, _('PBKDF2-HMAC-SHA256') ]);
        let renderer = new Gtk.CellRendererText();
        this._kdfTypeCombo.pack_start(renderer, true);
        this._kdfTypeCombo.add_attribute(renderer, 'text', 1);
        this._kdfTypeCombo.set_active_id(this.getSettings().get_enum(C.SETTINGS_KDF_TYPE).toString());
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

        this._adjustControls();
    },

    _loadSettings: function() {
        this._settings = Convenience.getSettings();
    },

    _loadUiFile: function() {
        let uiFile = Me.path + this.UI_FILE;
        let uiBuilder = new Gtk.Builder();

        if (uiBuilder.add_from_file(uiFile) == 0) {
            log('could not load the ui file: %s'.format(uiFile));
            return;
        }

        this._mainBox = uiBuilder.get_object('main-box');
        this._showCopyNotificationSwitch = uiBuilder.get_object('show-copy-notification-switch');
        this._shortcutKeybindTreeviewColumn = uiBuilder.get_object('shortcut-keybind-treeview-column');
        this._shortcutKeybindStore = uiBuilder.get_object('shortcut-keybind-store');
        this._shortcutKeybindTreeview = uiBuilder.get_object('shortcut-keybind-treeview');
        this._clipboardTimeoutEntry = uiBuilder.get_object('clipboard-timeout-entry');
        this._maxRecentDomainsEntry = uiBuilder.get_object('max-recent-domains-entry');
        this._compMethodStore = uiBuilder.get_object('comp-method-store');
        this._compMethodCombo = uiBuilder.get_object('comp-method-combo');
        this._hashTypeStore = uiBuilder.get_object('hash-type-store');
        this._hashTypeCombo = uiBuilder.get_object('hash-type-combo');
        this._kdfTypeStore = uiBuilder.get_object('kdf-type-store');
        this._kdfTypeCombo = uiBuilder.get_object('kdf-type-combo');
        this._passwordLengthEntry = uiBuilder.get_object('password-length-entry');
        this._passwordSaltEntry = uiBuilder.get_object('password-salt-entry');
        this._removeLowerAlphaCheck = uiBuilder.get_object('remove-lower-alpha-check');
        this._removeUpperAlphaCheck = uiBuilder.get_object('remove-upper-alpha-check');
        this._removeNumericCheck = uiBuilder.get_object('remove-numeric-check');
        this._removeSymbolsCheck = uiBuilder.get_object('remove-symbols-check');
        this._recentDomainsStore = uiBuilder.get_object('recent-domains-store');
        this._recentDomainsTreeview = uiBuilder.get_object('recent-domains-treeview');
        this._recentDomainsTreeviewSelection = uiBuilder.get_object('recent-domains-treeview-selection');
        this._recentDomainsTreeviewIdColumn = uiBuilder.get_object('recent-domains-treeview-id-column');
        this._recentDomainAdd = uiBuilder.get_object('recent-domains-add');
        this._recentDomainRemove = uiBuilder.get_object('recent-domains-remove');
    }
});

function init() {
}

function buildPrefsWidget() {
    let widget = new PassCalcPrefsWidget();
    widget.show_all();

    return widget;
}
