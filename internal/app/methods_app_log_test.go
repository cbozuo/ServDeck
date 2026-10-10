package app

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadAppLogTailByPathReturnsLatestLinesAndLevelBreakdown(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "gonavi.log")
	content := "" +
		"2026/06/09 10:00:00.000000 [INFO] boot ok\n" +
		"2026/06/09 10:00:01.000000 [WARN] slow mcp start\n" +
		"2026/06/09 10:00:02.000000 [ERROR] mysql dial failed\n"
	if err := os.WriteFile(logPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write log failed: %v", err)
	}

	result := readAppLogTailByPath(logPath, 2, "")
	if !result.Success {
		t.Fatalf("expected success, got failure: %s", result.Message)
	}

	snapshot, ok := result.Data.(appLogTailSnapshot)
	if !ok {
		t.Fatalf("expected appLogTailSnapshot, got %T", result.Data)
	}
	if snapshot.ReturnedLineCount != 2 {
		t.Fatalf("expected 2 returned lines, got %d", snapshot.ReturnedLineCount)
	}
	if !snapshot.MatchedLinesTruncated {
		t.Fatal("expected matched lines to be truncated when requesting fewer lines than available")
	}
	if snapshot.LevelBreakdown["WARN"] != 1 || snapshot.LevelBreakdown["ERROR"] != 1 {
		t.Fatalf("unexpected level breakdown: %#v", snapshot.LevelBreakdown)
	}
	if snapshot.Lines[0] != "2026/06/09 10:00:01.000000 [WARN] slow mcp start" {
		t.Fatalf("unexpected first returned line: %s", snapshot.Lines[0])
	}
	if snapshot.Lines[1] != "2026/06/09 10:00:02.000000 [ERROR] mysql dial failed" {
		t.Fatalf("unexpected second returned line: %s", snapshot.Lines[1])
	}
}

func TestReadAppLogTailRedactsCredentialLogFields(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		secrets  []string
		wantPart string
	}{
		{
			name:     "password assignment",
			content:  "2026/09/15 10:00:00.000000 [ERROR] connect failed：password=super-secret；错误链：timeout\n",
			secrets:  []string{"super-secret"},
			wantPart: "password=***",
		},
		{
			name:     "url userinfo",
			content:  "2026/09/15 10:00:01.000000 [ERROR] dial failed: scheme://alice:hunter2@example.com:8080\n",
			secrets:  []string{"alice", "hunter2"},
			wantPart: "scheme://***:***@",
		},
		{
			name:     "bearer token",
			content:  "2026/09/15 10:00:02.000000 [ERROR] request rejected: Bearer abc.def-ghi\n",
			secrets:  []string{"abc.def-ghi"},
			wantPart: "Bearer ***",
		},
		{
			name:     "quoted value",
			content:  "2026/09/15 10:00:03.000000 [ERROR] auth failed for \"quoted-secret\" user\n",
			secrets:  []string{"quoted-secret"},
			wantPart: "\"?\"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			logPath := filepath.Join(dir, "gonavi.log")
			if err := os.WriteFile(logPath, []byte(tt.content), 0o644); err != nil {
				t.Fatalf("write log failed: %v", err)
			}

			result := readAppLogTailByPath(logPath, 10, "")
			if !result.Success {
				t.Fatalf("expected success, got failure: %s", result.Message)
			}
			snapshot, ok := result.Data.(appLogTailSnapshot)
			if !ok || len(snapshot.Lines) != 1 {
				t.Fatalf("expected one log line, got %#v", result.Data)
			}
			got := snapshot.Lines[0]
			for _, secret := range tt.secrets {
				if strings.Contains(got, secret) {
					t.Fatalf("log tail leaked %q in %q", secret, got)
				}
			}
			if !strings.Contains(got, tt.wantPart) {
				t.Fatalf("log tail missing %q in %q", tt.wantPart, got)
			}
		})
	}
}

func TestReadAppLogTailByPathFiltersByKeywordCaseInsensitively(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "gonavi.log")
	content := "" +
		"2026/06/09 10:00:00.000000 [INFO] bootstrap ok\n" +
		"2026/06/09 10:00:01.000000 [ERROR] MCP start failed\n" +
		"2026/06/09 10:00:02.000000 [WARN] retry mcp connection\n"
	if err := os.WriteFile(logPath, []byte(content), 0o644); err != nil {
		t.Fatalf("write log failed: %v", err)
	}

	result := readAppLogTailByPath(logPath, 10, "mCp")
	if !result.Success {
		t.Fatalf("expected success, got failure: %s", result.Message)
	}

	snapshot, ok := result.Data.(appLogTailSnapshot)
	if !ok {
		t.Fatalf("expected appLogTailSnapshot, got %T", result.Data)
	}
	if snapshot.ReturnedLineCount != 2 {
		t.Fatalf("expected 2 matched lines, got %d", snapshot.ReturnedLineCount)
	}
	if snapshot.Keyword != "mCp" {
		t.Fatalf("expected original keyword to be preserved, got %q", snapshot.Keyword)
	}
	if snapshot.LevelBreakdown["ERROR"] != 1 || snapshot.LevelBreakdown["WARN"] != 1 {
		t.Fatalf("unexpected level breakdown after keyword filter: %#v", snapshot.LevelBreakdown)
	}
}

func TestReadAppLogTailByPathUsesLocalizedMissingLogMessage(t *testing.T) {
	result := readAppLogTailByPath("", 10, "")
	if result.Success {
		t.Fatalf("expected missing log path to fail")
	}
	if result.Message != "file.backend.error.app_log_file_not_found" {
		t.Fatalf("expected localized missing log key, got %q", result.Message)
	}
}
