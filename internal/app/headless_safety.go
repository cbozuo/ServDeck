package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"GoNavi-Wails/internal/connection"
	"GoNavi-Wails/internal/logger"
	"GoNavi-Wails/internal/sqlsafety"
)

// HeadlessSQLSafetyStatement identifies one statement considered by the
// command-line safety policy. It intentionally excludes SQL text so callers
// can report a denial without exposing statement values.
type HeadlessSQLSafetyStatement struct {
	Index     int
	Keyword   string
	Operation sqlsafety.SQLOperationType
}

// HeadlessSQLSafetyDecision is the shared AI-safety decision used by headless
// callers. AllowMutating is an acknowledgement only; it cannot override a
// disallowed operation.
type HeadlessSQLSafetyDecision struct {
	SafetyLevel           sqlsafety.SQLPermissionLevel
	Inspection            SQLInspection
	RequiresAllowMutating bool
	Disallowed            []HeadlessSQLSafetyStatement
	ConfirmRequired       []HeadlessSQLSafetyStatement
}

// HeadlessSQLPolicyError is returned before a headless command can dispatch a
// statement that is blocked by the AI safety policy or connection protection.
type HeadlessSQLPolicyError struct {
	Message string
}

func (err *HeadlessSQLPolicyError) Error() string {
	if err == nil || strings.TrimSpace(err.Message) == "" {
		return "headless SQL policy denied the request"
	}
	return err.Message
}

// GetSQLSafetyLevel reads the current SQL safety setting for this data root.
// A missing or unreadable configuration fails closed to read-only.
func (runtime *HeadlessRuntime) GetSQLSafetyLevel() sqlsafety.SQLPermissionLevel {
	if runtime == nil || runtime.app == nil {
		return sqlsafety.PermissionReadOnly
	}
	return readLegacySQLSafetyLevel(runtime.app.configDir)
}

// readLegacySQLSafetyLevel reads the legacy "safetyLevel" field from
// ai_config.json without pulling in the removed AI service. Any parse error or
// unknown value fails closed to read-only.
func readLegacySQLSafetyLevel(configDir string) sqlsafety.SQLPermissionLevel {
	type legacyAIConfig struct {
		SafetyLevel string `json:"safetyLevel"`
	}
	payload, err := os.ReadFile(filepath.Join(configDir, "ai_config.json"))
	if err != nil {
		if !os.IsNotExist(err) {
			logger.Warnf("headless SQL safety configuration unavailable; using readonly policy: %v", err)
		}
		return sqlsafety.PermissionReadOnly
	}
	var config legacyAIConfig
	if err := json.Unmarshal(payload, &config); err != nil {
		logger.Warnf("headless SQL safety configuration unreadable; using readonly policy: %v", err)
		return sqlsafety.PermissionReadOnly
	}
	return normalizeHeadlessSQLSafetyLevel(sqlsafety.SQLPermissionLevel(strings.TrimSpace(config.SafetyLevel)))
}

// EvaluateSQLSafety classifies every statement with the same safety levels
// used by AI and MCP execution. It is safe for CLI callers to display the
// returned metadata because it does not include SQL values.
func (runtime *HeadlessRuntime) EvaluateSQLSafety(config connection.ConnectionConfig, sql string) HeadlessSQLSafetyDecision {
	return evaluateHeadlessSQLSafety(runtime.GetSQLSafetyLevel(), resolveDDLDBType(config), sql)
}

func evaluateHeadlessSQLSafety(level sqlsafety.SQLPermissionLevel, dbType string, sql string) HeadlessSQLSafetyDecision {
	level = normalizeHeadlessSQLSafetyLevel(level)
	decision := HeadlessSQLSafetyDecision{
		SafetyLevel: level,
		Inspection: SQLInspection{
			ReadOnly:   true,
			Statements: []SQLStatementInspection{},
		},
		Disallowed:      []HeadlessSQLSafetyStatement{},
		ConfirmRequired: []HeadlessSQLSafetyStatement{},
	}

	for _, statement := range splitSQLStatementsForDialect(dbType, sql) {
		statement = strings.TrimSpace(statement)
		if statement == "" {
			continue
		}
		inspection := SQLStatementInspection{
			Index:    len(decision.Inspection.Statements) + 1,
			Keyword:  leadingSQLKeyword(statement),
			ReadOnly: isReadOnlySQLQuery(dbType, statement),
		}
		decision.Inspection.Statements = append(decision.Inspection.Statements, inspection)
		if !inspection.ReadOnly {
			decision.Inspection.ReadOnly = false
		}

		safetyStatement := HeadlessSQLSafetyStatement{
			Index:     inspection.Index,
			Keyword:   inspection.Keyword,
			Operation: classifyHeadlessSQLOperation(dbType, statement, inspection),
		}
		if !isHeadlessSQLOperationAllowed(level, safetyStatement.Operation) {
			decision.Disallowed = append(decision.Disallowed, safetyStatement)
			continue
		}
		if safetyStatement.Operation != sqlsafety.SQLOpQuery {
			decision.RequiresAllowMutating = true
			decision.ConfirmRequired = append(decision.ConfirmRequired, safetyStatement)
		}
	}
	decision.Inspection.StatementCount = len(decision.Inspection.Statements)
	return decision
}

func classifyHeadlessSQLOperation(dbType, statement string, inspection SQLStatementInspection) sqlsafety.SQLOperationType {
	if inspection.ReadOnly {
		return sqlsafety.SQLOpQuery
	}
	// 首关键字为读、但语句体内缺分号嵌入了写语句时（issue #1308），
	// sqlDataOperationInfo 仍会返回 select，必须改由内嵌写扫描给出真实关键字，
	// 否则写操作会被归为 SQLOpOther/DDL 而被误判为越权拒绝。
	keyword, _ := sqlDataOperationInfo(statement, dbType)
	if embedded := firstEmbeddedWriteKeyword(dbType, statement); embedded != "" {
		keyword = embedded
	}
	if isBatchableWriteSQLStatement(dbType, statement) || isSQLDataWriteKeyword(keyword) {
		return sqlsafety.SQLOpDML
	}
	switch keyword {
	case "create", "alter", "drop", "truncate", "rename":
		return sqlsafety.SQLOpDDL
	default:
		return sqlsafety.SQLOpOther
	}
}

func normalizeHeadlessSQLSafetyLevel(level sqlsafety.SQLPermissionLevel) sqlsafety.SQLPermissionLevel {
	switch level {
	case sqlsafety.PermissionReadOnly, sqlsafety.PermissionReadWrite, sqlsafety.PermissionFull:
		return level
	default:
		return sqlsafety.PermissionReadOnly
	}
}

func isHeadlessSQLOperationAllowed(level sqlsafety.SQLPermissionLevel, operation sqlsafety.SQLOperationType) bool {
	switch normalizeHeadlessSQLSafetyLevel(level) {
	case sqlsafety.PermissionReadOnly:
		return operation == sqlsafety.SQLOpQuery
	case sqlsafety.PermissionReadWrite:
		return operation == sqlsafety.SQLOpQuery || operation == sqlsafety.SQLOpDML
	case sqlsafety.PermissionFull:
		return true
	default:
		return operation == sqlsafety.SQLOpQuery
	}
}

func (runtime *HeadlessRuntime) authorizeHeadlessSQL(config connection.ConnectionConfig, sql string, allowMutating bool, requireDataImportProtection bool) error {
	return runtime.authorizeHeadlessSQLAtSafetyLevel(
		config,
		sql,
		allowMutating,
		requireDataImportProtection,
		runtime.GetSQLSafetyLevel(),
	)
}

func (runtime *HeadlessRuntime) authorizeHeadlessSQLAtSafetyLevel(config connection.ConnectionConfig, sql string, allowMutating bool, requireDataImportProtection bool, level sqlsafety.SQLPermissionLevel) error {
	if runtime == nil || runtime.app == nil {
		return &HeadlessSQLPolicyError{Message: "headless runtime is unavailable"}
	}
	decision := evaluateHeadlessSQLSafety(level, resolveDDLDBType(config), sql)
	if decision.Inspection.StatementCount == 0 {
		return &HeadlessSQLPolicyError{Message: "SQL is required"}
	}
	if len(decision.Disallowed) > 0 {
		return &HeadlessSQLPolicyError{Message: fmt.Sprintf(
			"SQL is blocked by AI safety level %q: %s",
			decision.SafetyLevel,
			formatHeadlessSQLSafetyStatements(decision.Disallowed),
		)}
	}
	if decision.RequiresAllowMutating && !allowMutating {
		return &HeadlessSQLPolicyError{Message: "mutating SQL requires --allow-write"}
	}

	if !decision.Inspection.ReadOnly {
		if err := runtime.app.authorizeHeadlessConnectionProtections(config, decision); err != nil {
			return err
		}
	}
	if requireDataImportProtection {
		if err := ensureConnectionAllowsActionWithText(
			config,
			connectionProtectionDataImport,
			"connection.backend.action.import_data",
			runtime.app.appText,
		); err != nil {
			return &HeadlessSQLPolicyError{Message: err.Error()}
		}
	}
	return nil
}

func (a *App) authorizeHeadlessConnectionProtections(config connection.ConnectionConfig, decision HeadlessSQLSafetyDecision) error {
	if a == nil {
		return &HeadlessSQLPolicyError{Message: "headless runtime is unavailable"}
	}
	if err := ensureConnectionAllowsActionWithText(
		config,
		connectionProtectionScriptExecution,
		"connection.backend.action.import_data",
		a.appText,
	); err != nil {
		return &HeadlessSQLPolicyError{Message: err.Error()}
	}
	for _, statement := range decision.ConfirmRequired {
		switch statement.Operation {
		case sqlsafety.SQLOpDML:
			if err := ensureConnectionAllowsActionWithText(config, connectionProtectionDataEdit, "connection.backend.action.apply_result_changes", a.appText); err != nil {
				return &HeadlessSQLPolicyError{Message: err.Error()}
			}
		case sqlsafety.SQLOpDDL:
			if err := ensureConnectionAllowsActionWithText(config, connectionProtectionStructureEdit, "connection.backend.action.import_data", a.appText); err != nil {
				return &HeadlessSQLPolicyError{Message: err.Error()}
			}
		case sqlsafety.SQLOpOther:
			// An unclassified statement can affect either data or structure.
			for _, protection := range []connectionProtectionKey{connectionProtectionDataEdit, connectionProtectionStructureEdit} {
				if err := ensureConnectionAllowsActionWithText(config, protection, "connection.backend.action.import_data", a.appText); err != nil {
					return &HeadlessSQLPolicyError{Message: err.Error()}
				}
			}
		}
	}
	return nil
}

// AuthorizeMCPConnectionSQL applies the same saved-connection write
// protections as the standalone CLI. MCP performs its own shared AI-safety and
// allowMutating checks before calling this method.
func (a *App) AuthorizeMCPConnectionSQL(config connection.ConnectionConfig, sql string) error {
	decision := evaluateHeadlessSQLSafety(sqlsafety.PermissionFull, resolveDDLDBType(config), sql)
	if decision.Inspection.StatementCount == 0 || decision.Inspection.ReadOnly {
		return nil
	}
	return a.authorizeHeadlessConnectionProtections(config, decision)
}

func formatHeadlessSQLSafetyStatements(statements []HeadlessSQLSafetyStatement) string {
	items := make([]string, 0, len(statements))
	for _, statement := range statements {
		keyword := strings.TrimSpace(statement.Keyword)
		if keyword == "" {
			keyword = "unknown"
		}
		items = append(items, fmt.Sprintf("#%d %s", statement.Index, keyword))
	}
	return strings.Join(items, ", ")
}
