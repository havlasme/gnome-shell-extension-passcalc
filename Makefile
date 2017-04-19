PLUGINNAME = passcalc
VERSION = 3.24

dist-filename = gnome-shell-extension-$(PLUGINNAME)
dist-archive = $(dist-filename).tar.gz $(dist-filename).tar.xz

release-filename = gnome-shell-extension-$(PLUGINNAME)-$(VERSION)
release-files += schemas/gschemas.compiled
release-files += schemas/org.gnome.shell.extensions.passcalc.gschema.xml
release-files += ui/prefs.gtkbuilder
release-files += clipboard.js
release-files += config.js
release-files += convenience.js
release-files += enum.js
release-files += extension.js
release-files += libsjcl.js
release-files += metadata.json
release-files += prefs.js
release-files += stylesheet.css
release-files += README.md
release-files += LICENSE.md
release-archive = $(release-filename).tar.gz $(release-filename).tar.xz $(release-filename).zip

.PHONY: install
install:
	@echo "TODO"

.PHONY: uninstall
uninstall:
	@echo "TODO"

.PHONY: clean
clean:
	@echo "TODO"

.PHONY: cleanall
cleanall: clean
	rm -f $(dist-archive)
	rm -f $(release-archive)

.PHONY: dist
dist: $(dist-archive)

.PHONY: release
release: $(release-archive)

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.passcalc.gschema.xml
	glib-compile-schemas schemas/

$(dist-filename).tar.gz: $(dist-files)
	tar -czf "$@" --transform "s/^\./$(dist-filename)/" $(addprefix ./,$^)

$(dist-filename).tar.xz: $(dist-files)
	tar -cJf "$@" --transform "s/^\./$(dist-filename)/" $(addprefix ./,$^)

$(release-filename).tar.gz: $(release-files)
	tar -czf "$@" --transform "s/^\./$(release-filename)/" $(addprefix ./,$^)

$(release-filename).tar.xz: $(release-files)
	tar -cJf "$@" --transform "s/^\./$(release-filename)/" $(addprefix ./,$^)

$(release-filename).zip: $(release-files)
	zip "$@" $^
