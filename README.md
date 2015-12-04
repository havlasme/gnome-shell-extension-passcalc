# gnome-shell-extension-passcalc

PassCalc extension for Gnome Shell

This extension calculates strong unique passwords for each identifier and passphrase combination.

## Features

- support to control length of calculated password
- multiple hash functions used to calculate password 
- support for optional hash salt
- support for limiting character groups (lower alpha/upper alpha/numbers/symbols) in calculated password
- quickly accessible recently used identifiers in drop-down menu
- support for activation with keyboard shortcut

## Password calculation formula

The formula used to calculate password is as simple as 
"[identifier][passphrase][salt]" -> SHA1/SHA-224/SHA-256/SHA-384/SHA-512 -> BASE64

## Thanks

Thanks to Thilo Maurer (https://github.com/thilomaurer) developer of original Password Calculator extension for 
Gnome Shell.
