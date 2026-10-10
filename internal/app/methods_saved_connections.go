package app

import (
	"fmt"
	"strings"

	"GoNavi-Wails/internal/connection"
)

func (a *App) savedConnectionRepository() *savedConnectionRepository {
	return newSavedConnectionRepository(a.configDir, a.secretStore)
}

func (a *App) GetSavedConnections() ([]connection.SavedConnectionView, error) {
	repository := a.savedConnectionRepository()
	if err := repository.MigrateLegacyCreatedAt(); err != nil {
		return nil, err
	}
	items, err := repository.List()
	if err != nil {
		return nil, err
	}
	return sanitizeSavedConnectionViews(items), nil
}

func (a *App) GetEditableSavedConnection(id string) (connection.SavedConnectionView, error) {
	view, err := a.savedConnectionRepository().Find(id)
	if err != nil {
		return connection.SavedConnectionView{}, err
	}
	// Editing relies on the Has* flags and explicit clear fields. Returning the
	// resolved bundle would expose every saved credential to the WebView.
	return sanitizeSavedConnectionView(view), nil
}

func (a *App) RevealSavedConnectionPrimaryPassword(id string) (string, error) {
	view, bundle, err := a.savedConnectionRepository().loadConnectionSnapshot(id)
	if err != nil {
		return "", err
	}
	if !view.HasPrimaryPassword || strings.TrimSpace(bundle.Password) == "" {
		return "", fmt.Errorf("saved connection has no stored primary password: %s", strings.TrimSpace(id))
	}
	return bundle.Password, nil
}

func (a *App) SaveConnection(input connection.SavedConnectionInput) (connection.SavedConnectionView, error) {
	view, err := a.savedConnectionRepository().Save(input)
	if err != nil {
		return connection.SavedConnectionView{}, err
	}
	return sanitizeSavedConnectionView(view), nil
}

func (a *App) UpdateConnectionVisibility(input connection.ConnectionVisibilityInput) (connection.SavedConnectionView, error) {
	view, err := a.savedConnectionRepository().UpdateVisibility(input)
	if err != nil {
		return connection.SavedConnectionView{}, err
	}
	return sanitizeSavedConnectionView(view), nil
}

func (a *App) DeleteConnection(id string) error {
	err := a.savedConnectionRepository().Delete(id)
	if err == nil {
		}
	return err
}

// DeleteConnections deletes saved connections and their credentials as one
// recoverable operation. It is used when a group tree is deleted from the UI.
func (a *App) DeleteConnections(ids []string) error {
	err := a.savedConnectionRepository().DeleteMany(ids)
	if err == nil && len(ids) > 0 {
		}
	return err
}

func (a *App) DuplicateConnection(id string) (connection.SavedConnectionView, error) {
	view, err := a.savedConnectionRepository().Duplicate(
		id,
		a.appText("connection.unnamed", nil),
		a.appText("connection.copy_suffix", nil),
	)
	if err != nil {
		return connection.SavedConnectionView{}, err
	}
	return sanitizeSavedConnectionView(view), nil
}

func (a *App) ImportLegacyConnections(items []connection.LegacySavedConnection) ([]connection.SavedConnectionView, error) {
	inputs := make([]connection.SavedConnectionInput, 0, len(items))
	for _, item := range items {
		input := connection.SavedConnectionInput(item)
		input.ClearPrimaryPassword = strings.TrimSpace(item.Config.Password) == ""
		input.ClearSSHPassword = strings.TrimSpace(item.Config.SSH.Password) == ""
		input.ClearProxyPassword = strings.TrimSpace(item.Config.Proxy.Password) == ""
		input.ClearHTTPTunnelPassword = strings.TrimSpace(item.Config.HTTPTunnel.Password) == ""
		input.ClearMySQLReplicaPassword = strings.TrimSpace(item.Config.MySQLReplicaPassword) == ""
		input.ClearMongoReplicaPassword = strings.TrimSpace(item.Config.MongoReplicaPassword) == ""
		input.ClearRedisSentinelPassword = strings.TrimSpace(item.Config.RedisSentinelPassword) == ""
		input.ClearOpaqueURI = strings.TrimSpace(item.Config.URI) == ""
		input.ClearOpaqueDSN = strings.TrimSpace(item.Config.DSN) == ""
		input.ClearJVMJMXPassword = strings.TrimSpace(item.Config.JVM.JMX.Password) == ""
		input.ClearJVMEndpointAPIKey = strings.TrimSpace(item.Config.JVM.Endpoint.APIKey) == ""
		input.ClearJVMAgentAPIKey = strings.TrimSpace(item.Config.JVM.Agent.APIKey) == ""
		input.ClearJVMDiagnosticAPIKey = strings.TrimSpace(item.Config.JVM.Diagnostic.APIKey) == ""
		_, sensitiveParams := partitionConnectionParams(item.Config.ConnectionParams)
		input.ClearSensitiveParams = strings.TrimSpace(sensitiveParams) == ""
		inputs = append(inputs, input)
	}
	views, err := a.importSavedConnectionsAtomically(inputs)
	if err != nil {
		return nil, err
	}
	return sanitizeSavedConnectionViews(views), nil
}

func (a *App) SaveGlobalProxy(input connection.SaveGlobalProxyInput) (connection.GlobalProxyView, error) {
	view, err := a.saveGlobalProxy(input)
	if err == nil {
		}
	return view, err
}

func (a *App) ImportLegacyGlobalProxy(input connection.LegacyGlobalProxyInput) (connection.GlobalProxyView, error) {
	return a.saveGlobalProxy(connection.SaveGlobalProxyInput(input))
}

// importSavedConnectionsAtomically 在写锁下逐条导入保存的连接。
// 云备份及其回滚快照随多数据源工作台退役，这里保留导入路径本身
// （旧的 WebKit 存储迁移仍依赖它）。
func (a *App) importSavedConnectionsAtomically(inputs []connection.SavedConnectionInput) ([]connection.SavedConnectionView, error) {
	repo := a.savedConnectionRepository()
	var result []connection.SavedConnectionView
	err := repo.withWriteLock(func() error {
		views := make([]connection.SavedConnectionView, 0, len(inputs))
		for _, input := range inputs {
			view, saveErr := repo.saveUnlocked(input)
			if saveErr != nil {
				return saveErr
			}
			views = append(views, view)
		}
		result = views
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
