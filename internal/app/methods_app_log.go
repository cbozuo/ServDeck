package app

import (
	"io"
	"os"
	"regexp"
	"strings"
	"unicode/utf8"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
)

// 应用日志面板（App Log）读取与脱敏。多数据源工作台退役后，这里只保留
// 通用凭据脱敏（密码、Bearer/Basic、URL userinfo、引号包裹的取值），
// 不再包含 SQL/Redis 方言级的语句改写。

const (
	defaultAppLogTailLineLimit = 80
	maxAppLogTailLineLimit     = 200
	appLogTailReadWindowBytes  int64 = 256 * 1024
	maxRedactedLogLineRunes    int   = 4 * 1024
)

type fileBackendTextFunc func(key string, params map[string]any) string

func fileBackendText(text fileBackendTextFunc, key string, params map[string]any) string {
	if text == nil {
		return key
	}
	return text(key, params)
}

type appLogTailSnapshot struct {
	LogPath               string         `json:"logPath"`
	Keyword               string         `json:"keyword,omitempty"`
	RequestedLineLimit    int            `json:"requestedLineLimit"`
	ReturnedLineCount     int            `json:"returnedLineCount"`
	FileWindowTruncated   bool           `json:"fileWindowTruncated"`
	MatchedLinesTruncated bool           `json:"matchedLinesTruncated"`
	LevelBreakdown        map[string]int `json:"levelBreakdown"`
	Lines                 []string       `json:"lines"`
}

func (a *App) ReadAppLogTail(lineLimit int, keyword string) connection.QueryResult {
	return readAppLogTailByPathWithText(logger.Path(), lineLimit, keyword, a.appText)
}

func normalizeAppLogTailLineLimit(input int) int {
	if input <= 0 {
		return defaultAppLogTailLineLimit
	}
	if input > maxAppLogTailLineLimit {
		return maxAppLogTailLineLimit
	}
	return input
}

func readAppLogTailWindow(filePath string, maxBytes int64) ([]byte, bool, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, false, err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return nil, false, err
	}
	size := fi.Size()
	if size <= 0 {
		return []byte{}, false, nil
	}

	offset := int64(0)
	truncated := false
	if maxBytes > 0 && size > maxBytes {
		offset = size - maxBytes
		truncated = true
	}

	buf := make([]byte, size-offset)
	if _, err := f.ReadAt(buf, offset); err != nil && err != io.EOF {
		return nil, false, err
	}
	if !truncated {
		return buf, false, nil
	}

	text := string(buf)
	if idx := strings.IndexByte(text, '\n'); idx >= 0 && idx+1 < len(text) {
		return []byte(text[idx+1:]), true, nil
	}
	return []byte{}, true, nil
}

func buildAppLogLevelBreakdown(lines []string) map[string]int {
	breakdown := map[string]int{
		"INFO":  0,
		"WARN":  0,
		"ERROR": 0,
		"OTHER": 0,
	}
	for _, line := range lines {
		switch {
		case strings.Contains(line, "[INFO]"):
			breakdown["INFO"]++
		case strings.Contains(line, "[WARN]"):
			breakdown["WARN"]++
		case strings.Contains(line, "[ERROR]"):
			breakdown["ERROR"]++
		default:
			breakdown["OTHER"]++
		}
	}
	return breakdown
}

func readAppLogTailByPath(filePath string, lineLimit int, keyword string) connection.QueryResult {
	return readAppLogTailByPathWithText(filePath, lineLimit, keyword, nil)
}

func readAppLogTailByPathWithText(filePath string, lineLimit int, keyword string, text fileBackendTextFunc) connection.QueryResult {
	target := strings.TrimSpace(filePath)
	if target == "" {
		return connection.QueryResult{Success: false, Message: fileBackendText(text, "file.backend.error.app_log_file_not_found", nil)}
	}

	if _, err := os.Stat(target); err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}

	windowBytes, fileWindowTruncated, err := readAppLogTailWindow(target, appLogTailReadWindowBytes)
	if err != nil {
		return connection.QueryResult{Success: false, Message: err.Error()}
	}

	normalizedKeyword := strings.ToLower(strings.TrimSpace(keyword))
	normalizedLineLimit := normalizeAppLogTailLineLimit(lineLimit)
	rawLines := strings.Split(strings.ReplaceAll(string(windowBytes), "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(rawLines))
	for _, rawLine := range rawLines {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		lines = append(lines, redactLogSensitiveText(line))
	}

	filteredLines := make([]string, 0, len(lines))
	for _, line := range lines {
		if normalizedKeyword != "" && !strings.Contains(strings.ToLower(line), normalizedKeyword) {
			continue
		}
		filteredLines = append(filteredLines, line)
	}

	matchedLinesTruncated := len(filteredLines) > normalizedLineLimit
	if matchedLinesTruncated {
		filteredLines = filteredLines[len(filteredLines)-normalizedLineLimit:]
	}

	snapshot := appLogTailSnapshot{
		LogPath:               target,
		Keyword:               strings.TrimSpace(keyword),
		RequestedLineLimit:    normalizedLineLimit,
		ReturnedLineCount:     len(filteredLines),
		FileWindowTruncated:   fileWindowTruncated,
		MatchedLinesTruncated: matchedLinesTruncated,
		LevelBreakdown:        buildAppLogLevelBreakdown(filteredLines),
		Lines:                 filteredLines,
	}
	return connection.QueryResult{Success: true, Data: snapshot}
}

// 应用日志行通用凭据脱敏：任何键值对中的密码/token/secret/API key、
// URL userinfo、Bearer/Basic 凭据以及引号包裹的取值都会被抹掉。
var (
	logSensitiveAssignmentPattern = regexp.MustCompile(`(?i)\b(password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key)\b(\s*(?:=|:)\s*)([^\s,;]+)`)
	logIdentifiedByPattern        = regexp.MustCompile(`(?i)\b(identified\s+by)(\s+)([^\s,;]+)`)
	logURIUserInfoPattern         = regexp.MustCompile(`(?i)([a-z][a-z0-9+.-]*://)([^\s/@:]+)(?::[^\s/@]*)?@`)
	logBareUserInfoPattern        = regexp.MustCompile(`(?i)\b[^\s:@/]+:[^\s@/]+@(\[[^\]\s]+\]|[a-z0-9.-]+)`)
	logSlashUserInfoPattern       = regexp.MustCompile(`(?i)\b[^\s/@:]+/[^\s@/]+@([a-z0-9.-]+)(?:/[^\s,;]*)?`)
	logBearerPattern              = regexp.MustCompile(`(?i)\bbearer\s+[a-z0-9._~+/=-]+`)
	logBasicAuthPattern           = regexp.MustCompile(`(?i)\bbasic\s+[a-z0-9+/=]+`)
)

func redactLogSensitiveText(message string) string {
	message = strings.TrimSpace(message)
	if message == "" {
		return ""
	}
	message = logURIUserInfoPattern.ReplaceAllString(message, `${1}***:***@`)
	message = logBareUserInfoPattern.ReplaceAllString(message, `***:***@$1`)
	message = logSlashUserInfoPattern.ReplaceAllString(message, `***/***@$1`)
	message = logBearerPattern.ReplaceAllString(message, "Bearer ***")
	message = logBasicAuthPattern.ReplaceAllString(message, "Basic ***")
	message = logSensitiveAssignmentPattern.ReplaceAllString(message, `${1}${2}***`)
	message = logIdentifiedByPattern.ReplaceAllString(message, `${1}${2}***`)
	message = redactQuotedLogSegments(message)
	message = strings.Map(func(r rune) rune {
		if r >= 0x00 && r < 0x20 || r == 0x7f {
			return ' '
		}
		return r
	}, message)
	return truncateLogLineRunes(strings.TrimSpace(message), maxRedactedLogLineRunes)
}

func redactQuotedLogSegments(value string) string {
	var out strings.Builder
	out.Grow(len(value))
	for index := 0; index < len(value); {
		if value[index] == '\'' || value[index] == '"' {
			quote := value[index]
			out.WriteByte(quote)
			out.WriteByte('?')
			out.WriteByte(quote)
			index = skipQuotedLogSegment(value, index, quote)
			continue
		}
		out.WriteByte(value[index])
		index++
	}
	return out.String()
}

func skipQuotedLogSegment(value string, start int, quote byte) int {
	for index := start + 1; index < len(value); index++ {
		if value[index] == '\\' {
			index++
			continue
		}
		if value[index] != quote {
			continue
		}
		if index+1 < len(value) && value[index+1] == quote {
			index++
			continue
		}
		return index + 1
	}
	return len(value)
}

func truncateLogLineRunes(value string, max int) string {
	if max <= 0 || utf8.RuneCountInString(value) <= max {
		return value
	}
	runes := []rune(value)
	return string(runes[:max])
}
