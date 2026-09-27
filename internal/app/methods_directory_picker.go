package app

import (
	"os"
	"path/filepath"
	"strings"

	"GoNavi-Wails/internal/connection"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// nearestExistingDir 从 path 逐级向上回溯，返回最近一个真实存在的目录。
//
// Windows 的 IFileDialog 在 DefaultDirectory 指向不存在的目录时会直接报错
// （"default directory '...' does not exist"）并拒绝打开对话框，用户看到的
// 是「浏览按钮点了没反应，只弹一个红条」。表单里的默认值常常是还没创建的
// 数据目录（如 D:\rustfs\data），所以必须在传给对话框前收敛到最近的祖先。
//
// 路径指向文件时回退到它所在的目录；相对路径先取绝对路径；一路回溯到根
// 仍不存在（理论上不会发生）时返回空串，交由对话框使用系统默认目录。
func nearestExistingDir(path string) string {
	dir := strings.TrimSpace(path)
	if dir == "" {
		return ""
	}
	if !filepath.IsAbs(dir) {
		abs, err := filepath.Abs(dir)
		if err != nil {
			return ""
		}
		dir = abs
	}
	for {
		info, err := os.Stat(dir)
		if err == nil && info.IsDir() {
			return filepath.Clean(dir)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		// 命中的是文件时只跳一级到它所在目录，不继续向上找。
		if err == nil && !info.IsDir() {
			if _, dirErr := os.Stat(parent); dirErr == nil {
				return filepath.Clean(parent)
			}
		}
		dir = parent
	}
}

// SelectDirectory 打开系统目录选择框，返回用户选中的绝对路径，供表单里的目录字段使用。
//
// 约定：
//   - 用户取消选择时返回 Success=true 且 Data=""，让调用方把「取消」当成正常分支；
//   - 对话框标题由调用方传入（通常是字段名），不传则回落到通用文案；
//   - defaultDirectory 不存在时回退到最近的已存在祖先目录，避免对话框直接报错；
//   - 只做路径规整，不校验目标目录是否存在、不创建目录，CanCreateDirectories 交给系统对话框处理。
func (a *App) SelectDirectory(title string, defaultDirectory string) connection.QueryResult {
	defaultDir := nearestExistingDir(defaultDirectory)

	dialogTitle := strings.TrimSpace(title)
	if dialogTitle == "" {
		dialogTitle = a.appText("app.data_root.action.select", nil)
	}

	selection, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                dialogTitle,
		DefaultDirectory:     defaultDir,
		CanCreateDirectories: true,
	})
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	if strings.TrimSpace(selection) == "" {
		return connection.QueryResult{Success: true, Data: ""}
	}
	return connection.QueryResult{Success: true, Data: filepath.Clean(selection)}
}
