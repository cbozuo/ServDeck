package app

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"GoNavi-Wails/internal/appdata"
	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/jvm"
	"GoNavi-Wails/internal/logger"
	proxytunnel "GoNavi-Wails/internal/proxy"
	"GoNavi-Wails/internal/secretstore"
	"GoNavi-Wails/shared/i18n"
)

// App 是 ServDeck 的应用后端。多数据源工作台退役后，这里只保留
// 服务管理、JVM 诊断、窗口/生命周期、更新与设置中心等能力的接线；
// 数据库连接缓存、查询注册表、SQL 审计等数据源域状态已随功能一起移除。

// App struct
type App struct {
	ctx             context.Context
	webRuntime      bool
	headlessRuntime bool
	startedAt       time.Time

	updateMu    sync.Mutex
	updateState updateState

	i18nMu    sync.RWMutex
	localizer *i18n.Localizer

	applicationQuitMu             sync.Mutex
	allowApplicationQuit          bool
	applicationQuitPromptInFlight bool

	dataRootApplyMu sync.Mutex

	configDir string

	downloadSourceMu     sync.RWMutex
	downloadSource       DownloadSource
	downloadSourceLoaded bool

	secretStore secretstore.SecretStore

	jvmPreviewTokenMu  sync.Mutex
	jvmPreviewTokens   map[string]jvmPreviewConfirmationToken
	jvmPreviewTokenTTL time.Duration
}

// NewApp creates a new App application struct
func NewApp() *App {
	return NewAppWithSecretStore(secretstore.NewKeyringStore())
}

// ConfigDirForIntegration returns the directory used for persisted application
// settings. It is a package function rather than an App method so Wails does
// not expose the local filesystem path through its reflective RPC bridge.
func ConfigDirForIntegration(a *App) string {
	if a == nil {
		return ""
	}
	return strings.TrimSpace(a.configDir)
}

// NewWebApp creates the backend used by the authenticated browser server.
// The immutable runtime marker keeps desktop-only Wails APIs from being
// reached through the reflective Web RPC bridge.
func NewWebApp() *App {
	app := NewApp()
	app.webRuntime = true
	return app
}

func NewAppWithSecretStore(store secretstore.SecretStore) *App {
	if store == nil {
		store = secretstore.NewUnavailableStore("secret store unavailable")
	}
	return &App{
		configDir:          resolveAppConfigDir(),
		downloadSource:     DownloadSourceCst,
		secretStore:        store,
		localizer:          newAppLocalizer(),
		jvmPreviewTokens:   make(map[string]jvmPreviewConfirmationToken),
		jvmPreviewTokenTTL: defaultJVMPreviewConfirmationTokenTTL,
	}
}

func newAppLocalizer() *i18n.Localizer {
	localizer, err := i18n.NewLocalizer(i18n.LanguageEnUS)
	if err != nil {
		logger.Warnf("加载应用多语言目录失败：%v", err)
		return nil
	}
	return localizer
}

func setDefaultAppLanguage(language i18n.Language) {
	defaultAppTextMu.Lock()
	defer defaultAppTextMu.Unlock()

	defaultAppTextLanguage = language
	if defaultAppTextLocalizer == nil {
		localizer, err := i18n.NewLocalizer(language)
		if err != nil {
			logger.Warnf("加载默认多语言目录失败：%v", err)
			return
		}
		defaultAppTextLocalizer = localizer
		return
	}
	defaultAppTextLocalizer.SetLanguage(language)
}

var (
	defaultAppTextMu       sync.RWMutex
	defaultAppTextLanguage = i18n.LanguageEnUS
	defaultAppTextLocalizer *i18n.Localizer
)

func defaultAppText(key string, params map[string]any) string {
	defaultAppTextMu.RLock()
	if defaultAppTextLocalizer != nil {
		text := defaultAppTextLocalizer.T(key, params)
		defaultAppTextMu.RUnlock()
		return text
	}
	defaultAppTextMu.RUnlock()

	defaultAppTextMu.Lock()
	defer defaultAppTextMu.Unlock()
	if defaultAppTextLocalizer == nil {
		localizer, err := i18n.NewLocalizer(defaultAppTextLanguage)
		if err != nil {
			logger.Warnf("加载默认多语言目录失败：%v", err)
			return key
		}
		defaultAppTextLocalizer = localizer
	}
	return defaultAppTextLocalizer.T(key, params)
}

func (a *App) SetLanguage(language string) {
	normalized, ok := i18n.NormalizeLanguage(language)
	if !ok {
		return
	}
	a.i18nMu.Lock()
	defer a.i18nMu.Unlock()
	if a.localizer == nil {
		a.localizer = newAppLocalizer()
	}
	if a.localizer != nil {
		a.localizer.SetLanguage(normalized)
	}
	setDefaultAppLanguage(normalized)
	jvm.SetBackendLanguage(normalized)
	proxytunnel.SetBackendLanguage(normalized)
}

func (a *App) appText(key string, params map[string]any) string {
	if a == nil {
		return key
	}
	a.i18nMu.RLock()
	if a.localizer != nil {
		text := a.localizer.T(key, params)
		a.i18nMu.RUnlock()
		return text
	}
	a.i18nMu.RUnlock()

	a.i18nMu.Lock()
	defer a.i18nMu.Unlock()
	if a.localizer == nil {
		a.localizer = newAppLocalizer()
	}
	if a.localizer == nil {
		return key
	}
	return a.localizer.T(key, params)
}

// InitializeLifecycle attaches runtime context without exposing lifecycle internals to Wails bindings.
func InitializeLifecycle(a *App, ctx context.Context) {
	a.startup(ctx)
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.startedAt = time.Now()
	if strings.TrimSpace(a.configDir) == "" {
		a.configDir = resolveAppConfigDir()
	}
	logger.Init()
	logStartupDiagnostics(a.configDir)
	a.loadPersistedGlobalProxy()
	a.loadPersistedDownloadSource()
	if err := migrateLegacyWebKitStorageIfNeeded(a); err != nil {
		logger.Warnf("迁移旧 WebKit 连接存储失败：%v", err)
	}
	if shouldInstallMacNativeWindowDiagnostics() {
		installMacNativeWindowDiagnostics(logger.Path())
	}
	applyMacWindowTranslucencyFix()
	logger.Infof("应用启动完成")
}

// SetWindowTranslucency 动态调整 macOS 窗口透明度。
// 前端在加载用户外观设置后、以及用户修改外观时调用此方法。
// opacity=1.0 且 blur=0 时窗口标记为 opaque，GPU 不再持续计算窗口背后的模糊合成。
func (a *App) SetWindowTranslucency(opacity float64, blur float64, darkAppearance bool) {
	setMacWindowTranslucency(opacity, blur, darkAppearance)
}

// SetMacNativeWindowControls is retained for compatibility with older frontends.
// macOS native traffic-light controls are now an application invariant.
func (a *App) SetMacNativeWindowControls(bool) {
	setMacNativeWindowControls(true)
}

// ResetWebViewZoom 把 WebView2 zoom factor 强制重置为 1.0，让 WebView2 重算字体度量。
// 用于 Windows 任务栏恢复后字体异常变大的"零感知"修复：不动窗口、零动画。
// 仅 Windows 上生效，其他平台返回错误（前端按需忽略）。
func (a *App) ResetWebViewZoom() (result connection.QueryResult) {
	defer func() {
		if recovered := recover(); recovered != nil {
			logger.Errorf("重置 WebView2 zoom 失败：%v", recovered)
			result = connection.QueryResult{
				Success: false,
				Message: a.appText("app.backend.error.reset_webview_zoom_failed", map[string]any{"detail": fmt.Sprint(recovered)}),
			}
		}
	}()
	if err := resetWebViewZoomFactor(a.ctx, 1.0); err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	return connection.QueryResult{Success: true, Message: "WebView2 zoom factor reset to 1.0"}
}

// RefreshWebViewBounds synchronises WebView2 controller bounds with the native
// Windows client rect. It repairs a startup maximise race without toggling the window.
func (a *App) RefreshWebViewBounds() (result connection.QueryResult) {
	defer func() {
		if recovered := recover(); recovered != nil {
			logger.Errorf("刷新 WebView2 窗口边界失败：%v", recovered)
			result = connection.QueryResult{
				Success: false,
				Message: fmt.Sprintf("failed to refresh WebView2 bounds: %v", recovered),
			}
		}
	}()
	if a == nil || a.ctx == nil {
		return connection.QueryResult{Success: false, Message: "application context is unavailable"}
	}
	if err := refreshWebViewBounds(a.ctx); err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	return connection.QueryResult{Success: true, Message: "WebView2 bounds refreshed"}
}

// SetMainWindowBackgroundColour 按主题切换主窗口类的背景刷（WM_ERASEBKGND 填充色）。
// 拖拽缩放时 ResizeDebounce 推迟 PutBounds，新暴露区域由该刷填充——
// 颜色与应用底色一致才能避免白块闪烁；暗色主题需换深色刷。
func (a *App) SetMainWindowBackgroundColour(dark bool) (result connection.QueryResult) {
	defer func() {
		if recovered := recover(); recovered != nil {
			logger.Errorf("切换主窗口背景刷失败：%v", recovered)
			result = connection.QueryResult{
				Success: false,
				Message: fmt.Sprintf("failed to set window background colour: %v", recovered),
			}
		}
	}()
	if a == nil || a.ctx == nil {
		return connection.QueryResult{Success: false, Message: "application context is unavailable"}
	}
	if err := setMainWindowBackgroundBrush(a.ctx, dark); err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}
	return connection.QueryResult{Success: true, Message: "window background colour updated"}
}

// LogWindowDiagnostic 记录前端采集到的窗口诊断信息，便于排查 macOS 原生全屏异常。
func (a *App) LogWindowDiagnostic(stage string, payload string) {
	stage = strings.TrimSpace(stage)
	payload = strings.TrimSpace(payload)
	if stage == "" {
		stage = "unknown"
	}
	logger.Warnf("窗口诊断：stage=%s payload=%s", stage, payload)
}

// Shutdown is called when the app terminates.
func (a *App) Shutdown() {
	logger.Infof("应用开始关闭，准备释放资源")
	closeJVMMonitoringSessions()
	proxytunnel.CloseAllForwarders()
	logger.Infof("资源释放完成，应用已关闭")
	logger.Close()
}

func dataRootInfoPayload(activeRoot string) map[string]interface{} {
	defaultRoot := appdata.DefaultRoot()
	currentRoot := strings.TrimSpace(activeRoot)
	if currentRoot == "" {
		currentRoot = appdata.MustResolveActiveRoot()
	}
	defaultSavedQueryDirectory := appdata.DefaultSavedQueryDirectory(currentRoot)
	savedQueryDirectory, err := appdata.ResolveSavedQueryDirectory(currentRoot)
	if err != nil || strings.TrimSpace(savedQueryDirectory) == "" {
		savedQueryDirectory = defaultSavedQueryDirectory
	}
	savedQueryDirectorySource := "custom"
	if directoriesEqual(savedQueryDirectory, defaultSavedQueryDirectory) {
		savedQueryDirectorySource = "default"
	}
	payload := map[string]interface{}{
		"path":                       currentRoot,
		"defaultPath":                defaultRoot,
		"driverPath":                 appdata.DriverRoot(currentRoot),
		"isDefaultPath":              filepath.Clean(currentRoot) == filepath.Clean(defaultRoot),
		"bootstrapPath":              appdata.BootstrapPath(),
		"savedQueryDirectory":        savedQueryDirectory,
		"defaultSavedQueryDirectory": defaultSavedQueryDirectory,
		"savedQueryDirectorySource":  savedQueryDirectorySource,
	}
	for key, value := range logDirectoryInfoPayload() {
		payload[key] = value
	}
	return payload
}
