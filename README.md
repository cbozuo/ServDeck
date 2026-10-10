<h1 align="center">ServDeck</h1>

<p align="center">
  <b>本地服务与数据源工作台 —— 服务注册即管、数据源连上即查，原生 Wails 而非 Electron。</b>
</p>

<p align="center">
  基于 <a href="https://wails.io">Wails v2</a>（Go）+ <a href="https://react.dev">React 18</a> 的桌面工作台，
  体积小、启动快；同一套 Go 内核提供桌面端、Web Server 与 headless CLI 三种形态。
</p>

---

## ✨ 功能

### 🧰 服务管理（Windows）
- 将 jar / 可执行程序**注册为 Windows 服务**（内置 servy 引擎）：安装、启动、停止、重启、重新注册、卸载
- **JDK 自动检测**：识别本机多个 Java 运行时，支持手动指定 JDK 目录或 java.exe 完整路径
- **JVM 参数配置**：-Xms/-Xmx 堆内存滑块与常用参数快捷写入、自定义 jvmArgs / 启动参数 / 工作目录
- **服务树分组**：分组管理、右键操作、名称筛选，服务与页签双向联动

### 📊 服务观测
- 服务状态 2 秒轮询，启停迁移实时反映到徽章，状态变化写入**事件时间线**
- 进程指标：CPU / 内存 / 线程 / 句柄 / 磁盘 IO / 网络连接数，运行趋势图
- **端口监听检查**（自动从启动参数解析 server.port 等配置）
- 服务目录占用统计、运行日志实时 tail、引擎事件日志

### 🗄 多数据源工作台
- **关系型**：MySQL（含 GoldenDB）· PostgreSQL · Oracle
- **缓存**：Redis（命令编辑、键浏览、编码切换）
- **文档**：MongoDB
- **消息队列**：RocketMQ · Kafka · RabbitMQ · MQTT（Topic 浏览、消息发布/消费、消费组视角）
- **向量库**：Chroma · Qdrant · Milvus
- **搜索**：Elasticsearch（REST 控制台，操作白名单与写保护）
- **注册中心**：Nacos 服务与配置查看
- Monaco SQL 编辑器（上下文补全）、虚拟化 DataGrid（单元格编辑 / 批量 CRUD / 事务提交回滚 / 筛选 / 导出 CSV·XLSX·JSON·Markdown）、表设计器、ER 图

### 🧪 JVM 诊断
- 通过 JMX 采集的 JVM 监控大盘、资源浏览、审计与诊断控制台（配套 `tools/jmx-helper`）

### 📦 导入 / 批量操作
- 数据导入工作台与导入任务历史
- 批量连接工作台：跨连接执行与结果汇总
- SSH 隧道、代理、连接配置导入导出

### 🌐 三种形态，一套内核

| 形态 | 说明 |
|---|---|
| 桌面端 | Wails 原生窗口（主形态，Windows / macOS / Linux） |
| Web Server | 同一界面走 HTTP / SSE，浏览器访问（实验性，支持 Docker） |
| CLI | headless 命令行，脚本化查询 / 导出 |

---

## 🚀 快速开始

**前置**：[Go](https://go.dev/dl/) 1.25+ · [Node.js](https://nodejs.org/) 18+ · [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2

```bash
git clone https://github.com/cbozuo/ServDeck.git
cd ServDeck

wails dev        # 开发（热重载）
wails build      # 构建，产物在 build/bin
```

---

## 🛠 常见问题

- **Windows 启动白屏 / 闪退**：多为系统缺少 WebView2 运行时，安装 [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) Evergreen Runtime 后重试
- **Linux 缺 WebKitGTK**：`sudo apt-get install -y libgtk-3-0 libwebkit2gtk-4.1-0`（Ubuntu 24.04+ / Debian 13）
- **Linux 中文乱码**：`sudo apt-get install -y fonts-noto-cjk && fc-cache -fv`

---

## License

[Apache-2.0](LICENSE)
