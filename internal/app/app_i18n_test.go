package app

import (
	"strings"
	"testing"

	"GoNavi-Wails/shared/i18n"
)

func TestAppBackendCatalogKeysExist(t *testing.T) {
	catalogs, err := i18n.LoadCatalogs()
	if err != nil {
		t.Fatalf("LoadCatalogs() error = %v", err)
	}

	keys := []string{
		"app.backend.error.reset_webview_zoom_failed",
	}
	for _, language := range i18n.SupportedLanguages() {
		catalog := catalogs[language]
		for _, key := range keys {
			if strings.TrimSpace(catalog[key]) == "" {
				t.Fatalf("%s catalog missing app backend key %q", language, key)
			}
		}
	}
}
