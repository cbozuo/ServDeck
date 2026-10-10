package app

import (
	"fmt"
	stdRuntime "runtime"
	"runtime/debug"
	"strings"

	"GoNavi-Wails/internal/logger"
)

func logStartupDiagnostics(configDir string) {
	_ = configDir
	buildInfo, _ := debug.ReadBuildInfo()
	logger.Infof("%s", buildStartupVersionLog(
		getCurrentVersion(),
		strings.TrimSpace(AppBuildTime),
		stdRuntime.GOOS,
		stdRuntime.GOARCH,
		buildInfo,
	))
}

func buildStartupVersionLog(version string, buildTime string, goos string, goarch string, buildInfo *debug.BuildInfo) string {
	version = strings.TrimSpace(version)
	if version == "" {
		version = "(unknown)"
	}
	goVersion := stdRuntime.Version()
	if buildInfo != nil && strings.TrimSpace(buildInfo.GoVersion) != "" {
		goVersion = strings.TrimSpace(buildInfo.GoVersion)
	}

	parts := []string{
		fmt.Sprintf("version=%s", version),
		fmt.Sprintf("go=%s", strings.TrimSpace(goVersion)),
		fmt.Sprintf("os=%s", strings.TrimSpace(goos)),
		fmt.Sprintf("arch=%s", strings.TrimSpace(goarch)),
	}
	if buildTime = strings.TrimSpace(buildTime); buildTime != "" {
		parts = append(parts, "buildTime="+buildTime)
	}
	if revision := startupBuildRevision(buildInfo); revision != "" {
		parts = append(parts, "revision="+revision)
	}
	return "ServDeck 启动信息：" + strings.Join(parts, " ")
}

func startupBuildRevision(buildInfo *debug.BuildInfo) string {
	if buildInfo == nil {
		return ""
	}
	for _, setting := range buildInfo.Settings {
		if setting.Key != "vcs.revision" {
			continue
		}
		revision := strings.TrimSpace(setting.Value)
		if len(revision) > 12 {
			revision = revision[:12]
		}
		return revision
	}
	return ""
}
