//go:build windows

package app

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
	winregistry "golang.org/x/sys/windows/registry"

	"GoNavi-Wails/internal/connection"
)

// javaRuntimeCandidate 是 DetectJavaRuntimes 返回的一个本机 Java 运行时。
type javaRuntimeCandidate struct {
	// 主版本号（17 / 21 / 8），取自目录名或注册表版本键。
	Version int `json:"version"`
	// 展示名（安装目录名）。
	Name string `json:"name"`
	// bin\java.exe 完整路径。
	Path string `json:"path"`
}

// DetectJavaRuntimes 检测本机 Java 运行时（添加服务弹窗「选择 JDK」候选列表）。
// 口径与高保真一致：JAVA_HOME → 注册表 HKLM\SOFTWARE\JavaSoft\JDK → 常见安装目录。
// 只做目录与 java.exe 存在性校验，不执行进程；找不到时返回空列表（前端引导手动指定）。
func (a *App) DetectJavaRuntimes() connection.QueryResult {
	return connection.QueryResult{Success: true, Data: map[string]any{"candidates": detectJavaRuntimeCandidates()}}
}

func detectJavaRuntimeCandidates() []javaRuntimeCandidate {
	seen := map[string]bool{}
	var list []javaRuntimeCandidate
	add := func(dir string) {
		javaExe := filepath.Join(dir, "bin", "java.exe")
		if seen[javaExe] || !serviceFileExists(javaExe) {
			return
		}
		seen[javaExe] = true
		major := javaMajorFromName(filepath.Base(dir))
		// 展示名对齐高保真：发行版 + 完整版本号（如 Temurin 17.0.9+9）。
		// java -version 一次性执行（3 秒超时），失败则回落目录名。
		name := filepath.Base(dir)
		if dist, full := describeJavaByVersion(javaExe); dist != "" {
			name = dist + " " + full
			if parsed := javaMajorFromVersion(full); parsed > 0 {
				major = parsed
			}
		}
		list = append(list, javaRuntimeCandidate{
			Version: major,
			Name:    name,
			Path:    javaExe,
		})
	}

	if home := strings.TrimSpace(os.Getenv("JAVA_HOME")); home != "" {
		add(home)
	}
	// 注册表：HKLM\SOFTWARE\JavaSoft\JDK\<版本>\JavaHome（Oracle / Temurin 安装器都会写）
	if javaHome := registryJavaHome(`SOFTWARE\JavaSoft\JDK`); javaHome != "" {
		add(javaHome)
	}
	if javaHome := registryJavaHome(`SOFTWARE\JavaSoft\Java Development Kit`); javaHome != "" {
		add(javaHome)
	}
	for _, dir := range commonJavaInstallRoots() {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			if entry.IsDir() {
				add(filepath.Join(dir, entry.Name()))
			}
		}
	}

	sort.SliceStable(list, func(i, j int) bool {
		if list[i].Version != list[j].Version {
			return list[i].Version > list[j].Version
		}
		return list[i].Name < list[j].Name
	})
	return list
}

// registryJavaHome 读注册表 JDK 键下主版本最新的 JavaHome。
func registryJavaHome(keyPath string) string {
	key, err := winregistry.OpenKey(winregistry.LOCAL_MACHINE, keyPath, winregistry.QUERY_VALUE|winregistry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return ""
	}
	defer key.Close()
	subKeys, err := key.ReadSubKeyNames(-1)
	if err != nil || len(subKeys) == 0 {
		return ""
	}
	sort.SliceStable(subKeys, func(i, j int) bool {
		vi, vj := javaMajorFromName(subKeys[i]), javaMajorFromName(subKeys[j])
		if vi != vj {
			return vi > vj
		}
		return subKeys[i] > subKeys[j]
	})
	for _, sub := range subKeys {
		subKey, err := winregistry.OpenKey(winregistry.LOCAL_MACHINE, keyPath+`\`+sub, winregistry.QUERY_VALUE)
		if err != nil {
			continue
		}
		value, _, err := subKey.GetStringValue("JavaHome")
		subKey.Close()
		if err == nil && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// commonJavaInstallRoots 常见 JDK 安装根目录（存在才参与枚举）。
func commonJavaInstallRoots() []string {
	roots := []string{
		`C:\Program Files\Java`,
		`C:\Program Files\Eclipse Adoptium`,
		`C:\Program Files\Zulu`,
		`C:\Program Files\Amazon Corretto`,
	}
	if programFiles := os.Getenv("ProgramFiles"); programFiles != "" {
		roots = append(roots,
			filepath.Join(programFiles, "Java"),
			filepath.Join(programFiles, "Eclipse Adoptium"),
		)
	}
	return roots
}

// javaMajorFromName 从目录名 / 版本键名提取主版本号。
// jdk-17.0.9 → 17；jdk1.8.0_481 → 8（老版本号 1.8 的「1.」是编号前缀，取第二段）；
// zulu-8 → 8；corretto-21.3 → 21。取不出返回 0。
func javaMajorFromName(name string) int {
	matches := regexp.MustCompile(`(?:jdk)?(\d{1,3}(?:[._]\d+)*)`).FindStringSubmatch(strings.ToLower(name))
	if len(matches) < 2 {
		return 0
	}
	return javaMajorFromVersion(matches[1])
}

// javaMajorFromVersion 从版本串取主版本号：17.0.9+9 → 17，1.8.0_481 → 8。
func javaMajorFromVersion(version string) int {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(version)), ".")
	if len(parts) == 0 {
		return 0
	}
	first, err := strconv.Atoi(strings.SplitN(parts[0], "_", 2)[0])
	if err != nil || first <= 0 || first > 100 {
		return 0
	}
	if first == 1 && len(parts) > 1 {
		// 1.8.0 / 1.7.0 这类遗留编号：真实主版本是第二段
		if second, err := strconv.Atoi(strings.SplitN(parts[1], "_", 2)[0]); err == nil && second > 0 && second <= 100 {
			return second
		}
	}
	return first
}

// describeJavaByVersion 执行 java -version 解析发行版与完整版本号（对齐高保真命名，
// 如 Temurin 17.0.9+9 / Zulu 8.0.392）。java -version 输出在 stderr，3 秒超时兜底；
// 解析不出时返回空串，调用方回落目录名。
// CREATE_NO_WINDOW：GUI 进程拉起控制台子进程时 Windows 会弹命令行窗口，
// 不压制的话用户每次检测 JDK 都会看到黑框闪一下。
func describeJavaByVersion(javaExe string) (dist string, fullVersion string) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, javaExe, "-version")
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: windows.CREATE_NO_WINDOW,
	}
	var output bytes.Buffer
	cmd.Stderr = &output
	cmd.Stdout = &output
	_ = cmd.Run()
	text := output.String()
	versionMatches := regexp.MustCompile(`version "([^"]+)"`).FindStringSubmatch(text)
	full := ""
	if len(versionMatches) > 1 {
		full = versionMatches[1]
	}
	// OpenJDK Runtime Environment Temurin-17.0.9+9 (build ...) / Zulu-8.0.392...
	if token := regexp.MustCompile(`Runtime Environment\s+([A-Za-z][A-Za-z0-9]*)[-_ ]?v?([0-9][^\s(]*)`).FindStringSubmatch(text); token != nil {
		return token[1], token[2]
	}
	// Java(TM) SE Runtime Environment (build 21.0.1+12) → Oracle / HotSpot
	if full == "" {
		return "", ""
	}
	if strings.Contains(text, "HotSpot") {
		return "Oracle", full
	}
	return "OpenJDK", full
}
