//go:build !windows

package app

import "errors"

type serviceEntry struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	State       string `json:"state"`
	StartType   string `json:"startType"`
}

var errHostServicesUnsupported = errors.New("windows service enumeration is only supported on windows")

func listServiceEntries() ([]serviceEntry, error) {
	return nil, errHostServicesUnsupported
}
