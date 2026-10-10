package app

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	stdRuntime "runtime"
	"sort"
	"strings"

	"GoNavi-Wails/internal/appdata"
	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

var dataRootMigrationExcludedEntries = map[string]struct{}{
	filepath.Base(appdata.BootstrapPath()):           {},
	filepath.Base(appdata.BootstrapLockPath()):       {},
	filepath.Base(appdata.SharedStorageLockPath("")): {},
}

type dataRootTextFunc func(string, map[string]any) string

type dataRootLocalizedError struct {
	message string
	cause   error
}

func (e dataRootLocalizedError) Error() string {
	return e.message
}

func (e dataRootLocalizedError) Unwrap() error {
	return e.cause
}

func dataRootText(text dataRootTextFunc, key string, params map[string]any) string {
	if text != nil {
		return text(key, params)
	}
	return defaultAppText(key, params)
}

func dataRootError(text dataRootTextFunc, key string, params map[string]any) error {
	return errors.New(dataRootText(text, key, params))
}

func dataRootErrorWithDetail(text dataRootTextFunc, key string, detail string, cause error, params map[string]any) error {
	resolved := make(map[string]any, len(params)+1)
	for name, value := range params {
		resolved[name] = value
	}
	resolved["detail"] = detail
	message := dataRootText(text, key, resolved)
	if cause == nil {
		return errors.New(message)
	}
	return dataRootLocalizedError{message: message, cause: cause}
}

func dataRootWrapError(text dataRootTextFunc, key string, cause error, params map[string]any) error {
	if cause == nil {
		return dataRootError(text, key, params)
	}
	return dataRootErrorWithDetail(text, key, cause.Error(), cause, params)
}

func dataRootLocalizeSetActiveRootError(text dataRootTextFunc, err error) error {
	if err == nil {
		return nil
	}
	switch {
	case errors.Is(err, appdata.ErrSetActiveRootCreateDataDirectory):
		detail := appdata.SetActiveRootErrorDetail(err)
		if detail == nil {
			detail = err
		}
		return dataRootErrorWithDetail(text, "app.data_root.backend.error.create_data_directory_failed", detail.Error(), err, nil)
	case errors.Is(err, appdata.ErrSetActiveRootCreateBootstrapDirectory):
		detail := appdata.SetActiveRootErrorDetail(err)
		if detail == nil {
			detail = err
		}
		return dataRootErrorWithDetail(text, "app.data_root.backend.error.create_bootstrap_directory_failed", detail.Error(), err, nil)
	default:
		return err
	}
}

func (a *App) GetDataRootDirectoryInfo() connection.QueryResult {
	return connection.QueryResult{Success: true, Message: "OK", Data: dataRootInfoPayload(a.configDir)}
}

func (a *App) SelectDataRootDirectory(currentDir string) connection.QueryResult {
	defaultDir := strings.TrimSpace(currentDir)
	if defaultDir == "" {
		defaultDir = appdata.MustResolveActiveRoot()
	}
	if !filepath.IsAbs(defaultDir) {
		if abs, err := filepath.Abs(defaultDir); err == nil {
			defaultDir = abs
		}
	}

	selection, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                a.appText("app.data_root.backend.dialog.select_directory", nil),
		DefaultDirectory:     defaultDir,
		CanCreateDirectories: true,
	})
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	if strings.TrimSpace(selection) == "" {
		return connection.QueryResult{Success: false, Message: "已取消"}
	}
	resolved, err := appdata.ResolveRoot(selection)
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	return connection.QueryResult{Success: true, Data: dataRootInfoPayload(resolved)}
}

func (a *App) ApplyDataRootDirectory(directory string, migrate bool) connection.QueryResult {
	a.dataRootApplyMu.Lock()
	defer a.dataRootApplyMu.Unlock()

	currentRoot := appdata.MustResolveActiveRoot()
	targetRoot, err := appdata.ResolveRoot(directory)
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	if filepath.Clean(currentRoot) == filepath.Clean(targetRoot) {
		a.configDir = targetRoot
		return connection.QueryResult{
			Success: true,
			Message: a.appText("app.data_root.backend.message.unchanged", nil),
			Data:    dataRootInfoPayload(targetRoot),
		}
	}

	if migrate {
		if err := migrateDataRootContentsWithText(currentRoot, targetRoot, a.appText); err != nil {
			return connection.QueryResult{Success: false, Message: err.Error()}
		}
	}

	appliedRoot, err := appdata.SetActiveRoot(targetRoot)
	if err != nil {
		return connection.QueryResult{Success: false, Message: dataRootLocalizeSetActiveRootError(a.appText, err).Error()}
	}
	a.configDir = appliedRoot
	message := a.appText("app.data_root.backend.message.updated_restart", nil)
	if migrate {
		message = a.appText("app.data_root.backend.message.migrated_restart", nil)
	}
	return connection.QueryResult{Success: true, Message: message, Data: dataRootInfoPayload(appliedRoot)}
}

func (a *App) OpenDataRootDirectory() connection.QueryResult {
	root := appdata.MustResolveActiveRoot()
	if stat, err := os.Stat(root); err != nil || !stat.IsDir() {
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.backend.error.directory_unavailable", nil)}
	}
	var cmd *exec.Cmd
	switch stdRuntime.GOOS {
	case "darwin":
		cmd = exec.Command("open", root)
	case "windows":
		cmd = exec.Command("explorer", root)
	case "linux":
		cmd = exec.Command("xdg-open", root)
	default:
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.backend.error.open_directory_unsupported", map[string]any{"platform": stdRuntime.GOOS})}
	}
	if err := cmd.Start(); err != nil {
		logger.Error(err, "打开数据目录失败")
		return connection.QueryResult{Success: false, Message: a.appText("app.data_root.backend.error.open_directory_failed", map[string]any{"detail": err.Error()})}
	}
	return connection.QueryResult{Success: true, Message: a.appText("app.data_root.backend.message.opened", nil), Data: dataRootInfoPayload(root)}
}

func migrateDataRootContents(sourceRoot string, targetRoot string) error {
	return migrateDataRootContentsWithText(sourceRoot, targetRoot, nil)
}

func migrateDataRootContentsWithText(sourceRoot string, targetRoot string, text dataRootTextFunc) error {
	sourceRoot = strings.TrimSpace(sourceRoot)
	targetRoot = strings.TrimSpace(targetRoot)
	if sourceRoot == "" || targetRoot == "" {
		return dataRootError(text, "app.data_root.backend.error.directory_empty", nil)
	}
	sourceAbs, err := filepath.Abs(sourceRoot)
	if err != nil {
		return dataRootWrapError(text, "app.data_root.backend.error.resolve_source_failed", err, nil)
	}
	targetAbs, err := filepath.Abs(targetRoot)
	if err != nil {
		return dataRootWrapError(text, "app.data_root.backend.error.resolve_target_failed", err, nil)
	}
	if filepath.Clean(sourceAbs) == filepath.Clean(targetAbs) {
		return nil
	}
	if rel, err := filepath.Rel(sourceAbs, targetAbs); err == nil && rel != "." && rel != "" && !strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel) {
		return dataRootError(text, "app.data_root.backend.error.target_inside_source", nil)
	}
	sourceRoot = sourceAbs
	targetRoot = targetAbs
	if err := os.MkdirAll(targetRoot, 0o755); err != nil {
		return dataRootWrapError(text, "app.data_root.backend.error.create_target_failed", err, nil)
	}
	sourceInfo, err := os.Stat(sourceRoot)
	if err != nil {
		return dataRootWrapError(text, "app.data_root.backend.error.read_source_root_failed", err, nil)
	}
	targetInfo, err := os.Stat(targetRoot)
	if err != nil {
		return dataRootWrapError(text, "app.data_root.backend.error.create_target_failed", err, nil)
	}
	if os.SameFile(sourceInfo, targetInfo) {
		return nil
	}

	return withDataRootSharedStorageLocks(sourceRoot, targetRoot, text, func() error {
		return migrateDataRootContentsUnlocked(sourceRoot, targetRoot, text)
	})
}

func migrateDataRootContentsUnlocked(sourceRoot string, targetRoot string, text dataRootTextFunc) error {
	entries, err := os.ReadDir(sourceRoot)
	if err != nil {
		return dataRootWrapError(text, "app.data_root.backend.error.read_source_root_failed", err, nil)
	}
	for _, entry := range entries {
		name := strings.TrimSpace(entry.Name())
		if name == "" {
			continue
		}
		if _, excluded := dataRootMigrationExcludedEntries[name]; excluded {
			continue
		}
		sourcePath := filepath.Join(sourceRoot, name)
		targetPath := filepath.Join(targetRoot, name)
		info, err := entry.Info()
		if err != nil {
			return dataRootWrapError(text, "app.data_root.backend.error.read_source_failed", err, map[string]any{"entry": name})
		}
		if info.IsDir() {
			if err := copyDir(sourcePath, targetPath); err != nil {
				return dataRootWrapError(text, "app.data_root.backend.error.migrate_directory_failed", err, map[string]any{"entry": name})
			}
			continue
		}
		if err := copyFile(sourcePath, targetPath, info.Mode()); err != nil {
			return dataRootWrapError(text, "app.data_root.backend.error.migrate_file_failed", err, map[string]any{"entry": name})
		}
	}
	if err := rewriteMigratedDataRootStateWithText(targetRoot, text); err != nil {
		return err
	}
	return nil
}

type dataRootSharedStorageLockTarget struct {
	key  string
	root string
}

func withDataRootSharedStorageLocks(sourceRoot string, targetRoot string, text dataRootTextFunc, operation func() error) error {
	targets := make([]dataRootSharedStorageLockTarget, 0, 2)
	for _, root := range []string{sourceRoot, targetRoot} {
		canonical, err := filepath.EvalSymlinks(root)
		if err != nil {
			return dataRootWrapError(text, "app.data_root.backend.error.migrate_directory_failed", err, map[string]any{"entry": "storage_lock"})
		}
		canonical = filepath.Clean(canonical)
		key := canonical
		if stdRuntime.GOOS == "windows" {
			key = strings.ToLower(key)
		}
		targets = append(targets, dataRootSharedStorageLockTarget{key: key, root: canonical})
	}
	sort.Slice(targets, func(i, j int) bool {
		return targets[i].key < targets[j].key
	})

	locks := make([]io.Closer, 0, len(targets))
	for index, target := range targets {
		if index > 0 && target.key == targets[index-1].key {
			continue
		}
		lock, err := appdata.AcquireFileLock(appdata.SharedStorageLockPath(target.root))
		if err != nil {
			var closeErr error
			for closeIndex := len(locks) - 1; closeIndex >= 0; closeIndex-- {
				closeErr = errors.Join(closeErr, locks[closeIndex].Close())
			}
			return dataRootWrapError(text, "app.data_root.backend.error.migrate_directory_failed", errors.Join(err, closeErr), map[string]any{"entry": "storage_lock"})
		}
		locks = append(locks, lock)
	}

	operationErr := operation()
	var closeErr error
	for index := len(locks) - 1; index >= 0; index-- {
		closeErr = errors.Join(closeErr, locks[index].Close())
	}
	if closeErr != nil {
		closeErr = dataRootWrapError(text, "app.data_root.backend.error.migrate_directory_failed", closeErr, map[string]any{"entry": "storage_lock"})
	}
	return errors.Join(operationErr, closeErr)
}

func rewriteMigratedDataRootState(targetRoot string) error {
	return rewriteMigratedDataRootStateWithText(targetRoot, nil)
}

func rewriteMigratedDataRootStateWithText(targetRoot string, text dataRootTextFunc) error {
	if err := rewriteSecurityUpdateBackupPathsWithText(targetRoot, text); err != nil {
		return err
	}
	return nil
}

func rewriteSecurityUpdateBackupPaths(targetRoot string) error {
	return rewriteSecurityUpdateBackupPathsWithText(targetRoot, nil)
}

func rewriteSecurityUpdateBackupPathsWithText(targetRoot string, text dataRootTextFunc) error {
	repo := newSecurityUpdateStateRepository(targetRoot)
	marker, err := repo.readMarker()
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return dataRootWrapError(text, "app.data_root.backend.error.read_migrated_security_update_state_failed", err, nil)
	}

	migrationID := strings.TrimSpace(marker.MigrationID)
	if migrationID == "" {
		return nil
	}

	targetBackupPath := repo.backupPath(migrationID)
	marker.BackupPath = targetBackupPath
	if err := repo.writeMarker(marker); err != nil {
		return dataRootWrapError(text, "app.data_root.backend.error.write_migrated_security_update_state_failed", err, nil)
	}

	manifestPath := repo.manifestPath(migrationID)
	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		if !os.IsNotExist(err) {
			return dataRootWrapError(text, "app.data_root.backend.error.read_migrated_security_update_manifest_failed", err, nil)
		}
	} else {
		var manifest securityUpdateBackupManifest
		if err := json.Unmarshal(manifestData, &manifest); err != nil {
			return dataRootWrapError(text, "app.data_root.backend.error.parse_migrated_security_update_manifest_failed", err, nil)
		}
		manifest.BackupPath = targetBackupPath
		if err := securityUpdateWriteJSONFile(manifestPath, manifest); err != nil {
			return dataRootWrapError(text, "app.data_root.backend.error.write_migrated_security_update_manifest_failed", err, nil)
		}
	}

	resultPath := repo.resultPath(migrationID)
	resultData, err := os.ReadFile(resultPath)
	if err != nil {
		if !os.IsNotExist(err) {
			return dataRootWrapError(text, "app.data_root.backend.error.read_migrated_security_update_result_failed", err, nil)
		}
	} else {
		var result SecurityUpdateStatus
		if err := json.Unmarshal(resultData, &result); err != nil {
			return dataRootWrapError(text, "app.data_root.backend.error.parse_migrated_security_update_result_failed", err, nil)
		}
		result.BackupPath = targetBackupPath
		result.BackupAvailable = strings.TrimSpace(targetBackupPath) != ""
		if err := securityUpdateWriteJSONFile(resultPath, result); err != nil {
			return dataRootWrapError(text, "app.data_root.backend.error.write_migrated_security_update_result_failed", err, nil)
		}
	}

	return nil
}

func copyDir(sourceDir string, targetDir string) error {
	return filepath.WalkDir(sourceDir, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		relativePath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}
		targetPath := filepath.Join(targetDir, relativePath)
		if entry.IsDir() {
			info, err := entry.Info()
			if err != nil {
				return err
			}
			return os.MkdirAll(targetPath, info.Mode())
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		return copyFile(path, targetPath, info.Mode())
	})
}

func copyFile(sourcePath string, targetPath string, mode os.FileMode) (err error) {
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return err
	}
	sourceFile, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	targetFile, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	// 迁移是写路径：网络盘回写缓存与配额耗尽常常直到 close(2) 才报 ENOSPC/EIO，
	// 此时 io.Copy 已返回成功。丢弃 Close 错误会让被截断的副本被判定为迁移成功，
	// 随后 SetActiveRoot 把活动数据根切到这份损坏的连接配置/审计库上。
	defer func() {
		if closeErr := targetFile.Close(); closeErr != nil && err == nil {
			err = closeErr
		}
	}()

	if _, err := io.Copy(targetFile, sourceFile); err != nil {
		return err
	}
	if err := targetFile.Sync(); err != nil {
		return err
	}
	return os.Chmod(targetPath, mode)
}
