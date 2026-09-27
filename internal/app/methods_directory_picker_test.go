package app

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNearestExistingDirFallsBackToClosestAncestor(t *testing.T) {
	root := t.TempDir()
	existing := filepath.Join(root, "existing")
	if err := os.MkdirAll(existing, 0o755); err != nil {
		t.Fatalf("mkdir fixture: %v", err)
	}

	cases := []struct {
		name string
		in   string
		want string
	}{
		{"命中已存在的目录本身", existing, existing},
		{"缺失一层回退到父目录", filepath.Join(existing, "missing"), existing},
		{"缺失多层回退到最近的祖先", filepath.Join(existing, "a", "b", "c"), existing},
		{"空串原样返回", "", ""},
		{"纯空白视为空", "   ", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := nearestExistingDir(tc.in)
			if got != tc.want {
				t.Fatalf("nearestExistingDir(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

// 表单里默认值可能指向文件而不是目录，Windows 对话框同样会拒绝，需要回到所在目录。
func TestNearestExistingDirTreatsFileAsParentDirectory(t *testing.T) {
	root := t.TempDir()
	file := filepath.Join(root, "rustfs.exe")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	if got := nearestExistingDir(file); got != root {
		t.Fatalf("nearestExistingDir(file) = %q, want %q", got, root)
	}
}

// t.TempDir() 的返回值已被 t.Cleanup 删除，正好用来构造「整条路径都不存在」的场景。
func TestNearestExistingDirReturnsEmptyWhenNothingExists(t *testing.T) {
	root := t.TempDir()
	gone := filepath.Join(root, "gone")
	if err := os.RemoveAll(root); err != nil {
		t.Fatalf("remove fixture: %v", err)
	}

	// 回溯到卷根为止：能存在就返回它，否则返回空串，两者都合法。
	got := nearestExistingDir(gone)
	if got != "" {
		if info, err := os.Stat(got); err != nil || !info.IsDir() {
			t.Fatalf("nearestExistingDir(%q) = %q, 该路径既非空也不存在", gone, got)
		}
	}
}
