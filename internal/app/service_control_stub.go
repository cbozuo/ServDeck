//go:build !windows

package app

import "errors"

// controlServiceEntry 非 Windows 构建没有 SCM，直接报不支持。
func controlServiceEntry(name string, action string) error {
	return errors.New("service control is only available on windows")
}
