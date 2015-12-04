/**
    Copyright (C) 2015 Tomáš Havlas <tomashavlas@raven-systems.eu>

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

const St = imports.gi.St;

const Clipboard = St.Clipboard.get_default();
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Config = Me.imports.config;
const Convenience = Me.imports.convenience;

const CLIPBOARD_TYPE = St.ClipboardType.CLIPBOARD;

function clear() {
    set('');
}

function get(callback) {
    Clipboard.get_text(CLIPBOARD_TYPE, callback);
}

function set(text) {
    Clipboard.set_text(CLIPBOARD_TYPE, text);
}
