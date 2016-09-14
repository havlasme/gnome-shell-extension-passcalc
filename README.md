# gnome-shell-extension-passcalc

PassCalc extension for Gnome Shell

This extension computes strong unique passwords for each domain and passphrase combination.

## Features

- activation with keyboard shortcut
- control length of computed password
- quickly accessible recently used domains in drop-down menu
- multiple hash functions used to compute password
- key derivation function as possibly safer alternative to simple string concatenation formula described below
- hash salt support
- filtering character groups (lower-case alpha / upper-case alpha / numbers / special symbols) in computed password
- clearing password from clipboard after specified time

## Password calculation formula

The formula used to compute password is as simple as
"[identifier][passphrase][salt]" -> SHA-256/SHA-512 -> BASE64

## Installation

https://extensions.gnome.org/extension/1021/passcalc/

## Thanks

Thanks to Thilo Maurer (https://github.com/thilomaurer) developer of original Password Calculator extension for 
Gnome Shell.
