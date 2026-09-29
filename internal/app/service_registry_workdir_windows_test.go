package app

import (
	"errors"
	"path/filepath"
	"testing"
)

func TestResolveServiceWorkDir(t *testing.T) {
	// 用真实存在的目录（临时目录与其盘符根）作为「有效目录」的确定来源。
	wd, err := filepath.Abs(".")
	if err != nil {
		t.Fatalf("resolve cwd: %v", err)
	}
	root := filepath.VolumeName(wd) + `\`
	existingDir := t.TempDir()
	rootedProgram := filepath.Join(existingDir, "server.jar")

	cases := []struct {
		name       string
		workDir    string
		program    string
		want       string
		wantErr    bool
		wantInvald bool
	}{
		{
			name:    "valid work dir passes through cleaned",
			workDir: root + `windows`,
			program: rootedProgram,
			want:    root + `windows`,
		},
		{
			name:    "volume-relative form is normalized to root",
			workDir: filepath.VolumeName(wd),
			program: rootedProgram,
			want:    root,
		},
		{
			name:    "empty work dir falls back to program directory",
			workDir: "",
			program: rootedProgram,
			want:    existingDir,
		},
		{
			name:    "missing work dir falls back to program directory",
			workDir: root + `definitely\not\here`,
			program: rootedProgram,
			want:    existingDir,
		},
		{
			name:       "both invalid yields workdirInvalidError",
			workDir:    root + `definitely\not\here`,
			program:    root + `definitely\not\here\app.jar`,
			wantErr:    true,
			wantInvald: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveServiceWorkDir(AddServiceRequest{WorkDir: tc.workDir, ProgramFile: tc.program})
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %q", got)
				}
				var invald *workdirInvalidError
				if tc.wantInvald && !errors.As(err, &invald) {
					t.Fatalf("expected workdirInvalidError, got %T", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("work dir = %q, want %q", got, tc.want)
			}
		})
	}
}
