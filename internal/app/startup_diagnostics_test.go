package app

import (
	"runtime/debug"
	"strings"
	"testing"
)

func TestBuildStartupVersionLogUsesResolvedRuntimeMetadata(t *testing.T) {
	info := &debug.BuildInfo{
		GoVersion: "go1.25.0",
		Settings: []debug.BuildSetting{
			{Key: "vcs.revision", Value: "abcdef1234567890"},
		},
	}

	got := buildStartupVersionLog("0.9.1", "2026-07-30T09:00:00Z", "linux", "amd64", info)
	for _, expected := range []string{
		"version=0.9.1",
		"buildTime=2026-07-30T09:00:00Z",
		"go=go1.25.0",
		"os=linux",
		"arch=amd64",
		"revision=abcdef123456",
	} {
		if !strings.Contains(got, expected) {
			t.Fatalf("startup version log %q does not contain %q", got, expected)
		}
	}
}
