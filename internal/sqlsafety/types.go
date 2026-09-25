package sqlsafety

// SQLPermissionLevel SQL 执行权限级别
type SQLPermissionLevel string

const (
	PermissionReadOnly  SQLPermissionLevel = "readonly"
	PermissionReadWrite SQLPermissionLevel = "readwrite"
	PermissionFull      SQLPermissionLevel = "full"
)

// SQLOperationType SQL 操作类型
type SQLOperationType string

const (
	SQLOpQuery SQLOperationType = "query" // SELECT, SHOW, DESCRIBE, EXPLAIN
	SQLOpDML   SQLOperationType = "dml"   // INSERT, UPDATE, DELETE
	SQLOpDDL   SQLOperationType = "ddl"   // CREATE, ALTER, DROP, TRUNCATE
	SQLOpOther SQLOperationType = "other"
)

// SafetyResult 安全检查结果
type SafetyResult struct {
	Allowed         bool             `json:"allowed"`
	OperationType   SQLOperationType `json:"operationType"`
	RequiresConfirm bool             `json:"requiresConfirm"`
	WarningMessage  string           `json:"warningMessage,omitempty"`
}
