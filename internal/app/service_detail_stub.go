//go:build !windows

package app

// serviceDetailSnapshot 非 Windows 构建返回占位快照。
type serviceDetailSnapshot struct {
	Name        string `json:"name"`
	Installed   bool   `json:"installed"`
	State       string `json:"state"`
	StartType   string `json:"startType"`
	ProgramFile string `json:"programFile"`
	LogDir      string `json:"logDir"`
}

func serviceDetailSnapshot(name string) (*serviceDetailSnapshot, error) {
	return &serviceDetailSnapshot{Name: name, Installed: true, State: "Unknown"}, nil
}

// serviceDetailSample 非 Windows 构建返回 Unknown 占位。
type serviceDetailSample struct {
	State string `json:"state"`
}

func sampleServiceDetailMetrics(name string) *serviceDetailSample {
	return &serviceDetailSample{State: "Unknown"}
}

type serviceLogFile struct {
	Name       string `json:"name"`
	SizeBytes  int64  `json:"sizeBytes"`
	ModifiedAt int64  `json:"modifiedAt"`
	Kind       string `json:"kind"`
}

func listServiceLogFiles(name string) ([]serviceLogFile, error) {
	return []serviceLogFile{}, nil
}

func readServiceLogFileTail(name string, file string, lineLimit int) (string, error) {
	return "", nil
}

func serviceDirUsage(name string, programFile string) (uint64, error) {
	return 0, nil
}

func listeningTCPPorts() map[int]bool {
	return map[int]bool{}
}

func extractConfiguredPorts(params string) []int {
	return nil
}

func uninstallServyService(name string) error {
	return errServiceRegistryUnsupported
}

func openServiceLogDirectory(name string) error {
	return errServiceRegistryUnsupported
}

// serviceEngineEvent 非 Windows 构建无 servy 引擎日志。
type serviceEngineEvent struct {
	At    int64  `json:"at"`
	Level string `json:"level"`
	Text  string `json:"text"`
}

func readServyEngineEvents(name string, limit int) []serviceEngineEvent {
	return []serviceEngineEvent{}
}

func saveServiceConfFile(name string, file string, content string) error {
	return errServiceRegistryUnsupported
}
