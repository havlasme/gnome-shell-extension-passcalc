/**
    Copyright (C) 2015 Tomáš Havlas <tomashavlas@raven-systems.eu>
    Copyright (C) 2013 Thilo Maurer <maurer.thilo@gmail.com>

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

const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Lang = imports.lang;
const St = imports.gi.St;
const Shell = imports.gi.Shell;

const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;

const Gettext = imports.gettext.domain('gnome-shell-extension-passcalc');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Clipboard = Me.imports.clipboard;
const Config = Me.imports.config;
const Convenience = Me.imports.convenience;
const Enum = Me.imports.enum;
const SJCL = Me.imports.libsjcl;

const ID_ENTRY_FOCUS_TIMEOUT = 20;

const RecentIdPopupMenuItem = new Lang.Class({
    Name: 'RecentIdPopupMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (text, params) {
        this.parent(params);

        this.label = new St.Label({ text: text });
        this.actor.add_child(this.label);
        this.actor.label_actor = this.label;
    },
    
    activate: function(event) {
        this._parent.close(true);
        this.emit('selected');
    }
});

const PasswordCalculator = Lang.Class({
    Name: 'PasswordCalculator',
    Extends: PanelMenu.Button,
    _pw: '',

    _init: function() {
        this.parent(0.0, _('PasswCalc'));
        Me.extension = this;
        
        this._settings = Convenience.getSettings();
        
        let hbox = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        let icon = new St.Icon({ 
            icon_name: 'dialog-password-symbolic',
            style_class: 'system-status-icon'
        });

        hbox.add_child(icon);
        hbox.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.actor.add_child(hbox);
        
        let controlForm = new PopupMenu.PopupMenuSection({
            reactive: false
        });
        
        this.idEntry = new St.Entry({
            name: 'idEntry',
            hint_text: _('identifier'),
            track_hover: true,
            can_focus: true,
            style_class: 'search-entry first-entry'
        });
        this.idEntry.clutter_text.connect('key-release-event', Lang.bind(this, this.calculatePassword));
        
        this.passphraseEntry = new St.Entry({
            name: 'passphraseEntry',
            hint_text: _('passphrase'),
            track_hover: true,
            can_focus: true,
            style_class: 'search-entry last-entry'
        });
        this.passphraseEntry.clutter_text.connect('text-changed', Lang.bind(this, function(o, e) {
            let pwc = '';
            if (this.passphraseEntry.get_text() != '') {
                pwc = '\u25cf'; // ● U+25CF BLACK CIRCLE
            }
            this.passphraseEntry.clutter_text.set_password_char(pwc);
        }));
        this.passphraseEntry.clutter_text.connect('key-release-event', Lang.bind(this, this.calculatePassword));
        this.passwordBox = new St.Label({
            text: _('your password'),
            style_class: 'password-box'
        });
        
        controlForm.actor.add_actor(this.idEntry);
        controlForm.actor.add_actor(this.passphraseEntry);
        controlForm.actor.add_actor(this.passwordBox);
        controlForm.actor.add_style_class_name('passcalc');
        
        this.recentIdCombo = new PopupMenu.PopupSubMenuMenuItem('');
        this.updateRecentIds();
        
        this.menu.addMenuItem(controlForm);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this.recentIdCombo);
        this.menu.connect('open-state-changed', Lang.bind(this, function(sender, open) {
            this.clearEntry();
            if (open) {
                Mainloop.timeout_add(ID_ENTRY_FOCUS_TIMEOUT, Lang.bind(this, function() {
                    this.idEntry.grab_key_focus();
                }));
            }
        }));
        this._settings.connect('changed', Lang.bind(this, function() {
            this.updateRecentIds();
        }));
    },
    
    _onOpenPasswordCalcualtor: function() {
        this.menu.open();
    },
    
    addRecentId: function(id) {
        let current = this._settings.get_strv(Config.SETTINGS_RECENT_IDENTIFIERS);
        let index = current.indexOf(id);
        
        if (index >= 0) {
            current.splice(index, 1);
        }
        
        current.unshift(id);
        this._settings.set_strv(Config.SETTINGS_RECENT_IDENTIFIERS, current);
        this.updateRecentIds();
    },
    
    calculatePassword: function(o, e) {
        let id = this.idEntry.get_text();
        let pp = this.passphraseEntry.get_text();
        
        if (id != '' && pp != '') {
            let salt = this._settings.get_string(Config.SETTINGS_PASSWORD_SALT);  
            let pw = id + pp + salt;
            let pwlen = this._settings.get_int(Config.SETTINGS_PASSWORD_LENGTH);
            if (this._settings.get_enum(Config.SETTINGS_COMP_METHOD) == Enum.COMP_METHOD.CONCAT) {
                switch(this._settings.get_enum(Config.SETTINGS_HASH_TYPE)) {
                    case Enum.HASH_TYPE.SHA256:
                        pw = SJCL.hash.sha256(pw);
                        break;
                    case Enum.HASH_TYPE.SHA512:
                        pw = SJCL.hash.sha512(pw);
                        break;
                }
            } else {
                switch(this._settings.get_enum(Config.SETTINGS_KDF_TYPE)) {
                    case Enum.KDF_TYPE.HKDF_SHA256:
                        pw = SJCL.hkdf.sha256(id, pp, salt, pwlen*6);
                        break;
                    case Enum.KDF_TYPE.HKDF_SHA512:
                        pw = SJCL.hkdf.sha512(id, pp, salt, pwlen*6);
                        break;
                }
            }

            if (this._settings.get_boolean(Config.SETTINGS_REMOVE_LOWER_ALPHA)) {
                pw = pw.replace(/[a-z]+/g, '');
            }
            if (this._settings.get_boolean(Config.SETTINGS_REMOVE_UPPER_ALPHA)) {
                pw = pw.replace(/[A-Z]+/g, '');
            }
            if (this._settings.get_boolean(Config.SETTINGS_REMOVE_NUMERIC)) {
                pw = pw.replace(/[0-9]+/g, '');
            }
            if (this._settings.get_boolean(Config.SETTINGS_REMOVE_SYMBOLS)) {
                pw = pw.replace(/\W+/g, '');
            }
            
            if (pw.length < 1) {
                Main.notify(_('Unable to calculate password with current settings.'));
                return;
            }
            
            while (pw.length < pwlen) {
                pw += pw;
            }
            if (pw.length > pwlen) {
                pw = pw.substr(0, pwlen);
            }
            
            this.passwordBox.set_text(pw.substr(0,3) + '.........' + pw.substr(pw.length-3,pw.length));

            let symbol = e.get_key_symbol();
            if (symbol == Clutter.Return || symbol == Clutter.KP_Enter) {
                this.addRecentId(id);
                if (this._settings.get_boolean(Config.SETTINGS_SHOW_NOTIFICATION)) {
                    Main.notify(_('PassCalc: Password copied to clipboard.'));
                }
                Clipboard.set(pw);
                this.menu.close();
                
                this._pw = SJCL.hash.sha512(pw);
                Mainloop.timeout_add(this._settings.get_int(Config.SETTINGS_CLIPBOARD_TIMEOUT), Lang.bind(this, function() {
                    Clipboard.get(Lang.bind(this, function(cb, text) {
                        if (this._pw == SJCL.hash.sha512(text)) {
                            Clipboard.clear();
                        }
                        this._pw = '';
                    }));
                }));
            }
        } else {
            this.passwordBox.set_text(_('your password'));
        }
    },

    clearEntry: function() {
        this.idEntry.set_text('');
        this.passphraseEntry.set_text('');
        this.passwordBox.set_text(_('your password'));
    },
    
    destroy: function() {
        this.parent();
    },
    
    updateRecentIds: function() {
        this.recentIdCombo.menu.removeAll();
        
        let recent = this._settings.get_strv(Config.SETTINGS_RECENT_IDENTIFIERS);
        let maxRecent = this._settings.get_int(Config.SETTINGS_RECENT_IDENTIFIERS_MAXIMUM);
        for (let i=0,l=recent.length; i<l&&(maxRecent==0||i<maxRecent); i++) {
            let item = new RecentIdPopupMenuItem(recent[i]);
            this.recentIdCombo.menu.addMenuItem(item, i);
            item.connect('selected', Lang.bind(this, function(s, id) {
                this.idEntry.set_text(id);
                this.passphraseEntry.clutter_text.grab_key_focus();
            }, recent[i]));
        }
        this.recentIdCombo.label.set_text(recent.length ? _('Recent Identifiers') : _('No recent identifiers'));
    }
});

function init() {
    Convenience.initTranslations();
}

let _indicator;

function enable() {
    _indicator = new PasswordCalculator;
    Main.panel.addToStatusArea('passcalc', _indicator);
    Main.wm.addKeybinding(Config.SETTINGS_SHORTCUT_KEYBIND, Me.extension._settings, Meta.KeyBindingFlags.NONE,
                          Shell.ActionMode.NORMAL, Lang.bind(Me.extension, Me.extension._onOpenPasswordCalcualtor));
}

function disable() {
    _indicator.destroy();
    Main.wm.removeKeybinding(Config.SETTINGS_SHORTCUT_KEYBIND);
}
