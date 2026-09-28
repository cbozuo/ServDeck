//go:build !windows

package app

// sampleServiceMetrics 非 Windows 构建没有 SCM，只回 Unknown 占位，前端按未知状态渲染。
func sampleServiceMetrics(names []string) ([]serviceMetricSample, error) {
	result := make([]serviceMetricSample, 0, len(names))
	for _, name := range names {
		result = append(result, serviceMetricSample{Name: name, State: "Unknown"})
	}
	return result, nil
}
