package app

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"GoNavi-Wails/internal/connection"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// iconPickMaxBytes 是自定义图标的体积上限。
// 图标最终要进 localStorage（服务列表是本地持久化的），原图动辄几 MB 会迅速顶到配额，
// 所以在选图这一步就挡住，让用户在源头上换一张小图。
const iconPickMaxBytes = 2 << 20 // 2 MiB

// iconPickMimeTypes 是允许的图片扩展名与 MIME 映射。
// SVG 也放行：作为 <img> 的 data URL 加载不会执行脚本，而矢量图标在这个尺寸下最清晰。
var iconPickMimeTypes = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".gif":  "image/gif",
	".bmp":  "image/bmp",
	".ico":  "image/x-icon",
	".svg":  "image/svg+xml",
}

// SelectImageFile 打开图片选择框，返回可直接喂给 <img src> 的 data URL。
//
// 为什么返回 data URL 而不是路径：前端跑在 WebView 里，拿不到本地文件系统，
// 而外观预览与服务树图标都要立刻显示。图标本来就是小图，一次 base64 往返足够。
//
// 约定与 SelectServiceProgramFile 一致：用户取消返回 Success=true 且 Data 为空，
// 调用方把「取消」当正常分支处理。
func (a *App) SelectImageFile(title string) connection.QueryResult {
	if a.webRuntime {
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.log_directory.backend.error.desktop_only", nil)}
	}

	filters := []wailsruntime.FileFilter{
		{
			DisplayName: a.appText("service.modal.look.imageFilter", nil),
			Pattern:     "*.png;*.jpg;*.jpeg;*.webp;*.gif;*.bmp;*.ico;*.svg",
		},
		{DisplayName: a.appText("file.backend.filter.all_files_pattern", nil), Pattern: "*.*"},
	}
	dialogTitle := strings.TrimSpace(title)
	if dialogTitle == "" {
		dialogTitle = a.appText("service.modal.look.upload", nil)
	}

	selection, err := wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title:   dialogTitle,
		Filters: filters,
	})
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	selection = strings.TrimSpace(selection)
	if selection == "" {
		return connection.QueryResult{Success: true, Data: ""}
	}

	mime, supported := iconPickMimeTypes[strings.ToLower(filepath.Ext(selection))]
	if !supported {
		return connection.QueryResult{Success: false, Message: a.appText("service.modal.look.uploadUnsupported", nil)}
	}
	info, err := os.Stat(selection)
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	if info.Size() > iconPickMaxBytes {
		return connection.QueryResult{Success: false, Message: a.appText("service.modal.look.uploadTooLarge", nil)}
	}
	raw, err := os.ReadFile(selection)
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}

	return connection.QueryResult{Success: true, Data: map[string]any{
		"dataUrl": "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(raw),
		"name":    filepath.Base(selection),
	}}
}
