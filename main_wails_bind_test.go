package main

import (
	"testing"

	"GoNavi-Wails/internal/app"
	"GoNavi-Wails/internal/nativewindow"
	"GoNavi-Wails/internal/secretstore"
)

func TestNewBindingsSecretStoreDoesNotOpenKeyring(t *testing.T) {
	store := newBindingsSecretStore()
	if err := store.HealthCheck(); err == nil || !secretstore.IsUnavailable(err) {
		t.Fatalf("HealthCheck() = %v, want unavailable store", err)
	}
}

func TestCollectWailsBindingsKeepsDesktopOrder(t *testing.T) {
	store := newBindingsSecretStore()
	application := app.NewAppWithSecretStore(store)

	withoutManager := collectWailsBindings(application, nil)
	if len(withoutManager) != 1 {
		t.Fatalf("len(bindings) = %d, want 1", len(withoutManager))
	}
	if withoutManager[0] != application {
		t.Fatalf("bindings = %#v, want App only", withoutManager)
	}

	manager := &nativewindow.Manager{}
	withManager := collectWailsBindings(application, manager)
	if len(withManager) != 2 {
		t.Fatalf("len(bindings) = %d, want 2", len(withManager))
	}
	if withManager[1] != manager {
		t.Fatalf("bindings[1] = %#v, want native window manager", withManager[1])
	}
}
