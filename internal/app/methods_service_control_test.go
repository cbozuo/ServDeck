package app

import "testing"

// TestControlWindowsServiceValidation 校验绑定层参数防线；nil App 时 appText 原样返回 key，
// 便于断言走的是校验失败分支而非 SCM 调用。
func TestControlWindowsServiceValidation(t *testing.T) {
	var a *App
	tests := []struct {
		name    string
		service string
		action  string
		success bool
	}{
		{"服务名为空拒绝", "", "start", false},
		{"服务名空白拒绝", "   ", "stop", false},
		{"非法动作拒绝", "some-service", "pause", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := a.ControlWindowsService(tt.service, tt.action)
			if result.Success != tt.success {
				t.Fatalf("Success = %v, want %v (message: %s)", result.Success, tt.success, result.Message)
			}
			if result.Success == false && result.Message == "" {
				t.Fatalf("校验失败分支必须返回可展示 Message")
			}
		})
	}
}

// TestSampleServiceMetricsEmptyInput 空输入/全空白输入不应触达 SCM，直接返回空样本集。
func TestSampleServiceMetricsEmptyInput(t *testing.T) {
	var a *App
	tests := []struct {
		name  string
		input []string
	}{
		{"空列表返回空结果", nil},
		{"全空白名去重后为空", []string{"", "   "}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := a.SampleServiceMetrics(tt.input)
			if !result.Success {
				t.Fatalf("Success = false, want true (message: %s)", result.Message)
			}
			data, ok := result.Data.(map[string]any)
			if !ok {
				t.Fatalf("Data 类型 = %T, want map[string]any", result.Data)
			}
			services, ok := data["services"].([]serviceMetricSample)
			if !ok {
				t.Fatalf("services 类型 = %T, want []serviceMetricSample", data["services"])
			}
			if len(services) != 0 {
				t.Fatalf("services 长度 = %d, want 0", len(services))
			}
		})
	}
}
