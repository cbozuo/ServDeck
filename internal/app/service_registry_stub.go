//go:build !windows

package app

import "errors"

type serviceProbeResult struct {
	Exists     bool   `json:"exists"`
	State      string `json:"state,omitempty"`
	StartType  string `json:"startType,omitempty"`
	FileExists bool   `json:"fileExists"`
}

type serviceAddResult struct {
	Managed    bool   `json:"managed"`
	Registered bool   `json:"registered"`
	Name       string `json:"name"`
	LogDir     string `json:"logDir,omitempty"`
	Output     string `json:"output,omitempty"`
}

var errServiceRegistryUnsupported = errors.New("windows service registry is only supported on windows")

func probeServiceEntry(string, string) (serviceProbeResult, error) {
	return serviceProbeResult{}, errServiceRegistryUnsupported
}

func locateServyEngine() (string, error) {
	return "", errServiceRegistryUnsupported
}

// servyEngineVersion 非 Windows 构建没有引擎可探测，始终返回空串。
func servyEngineVersion(string) string {
	return ""
}

func registerServiceWithServy(AddServiceRequest) (serviceAddResult, error) {
	return serviceAddResult{}, errServiceRegistryUnsupported
}
