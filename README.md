<h1 align="center">ServDeck</h1>

<p align="center">
  <b>本地服务管理工作台 —— 服务注册即管、运行状态尽收眼底，原生 Wails 而非 Electron。</b>
</p>

<p align="center">
  基于 <a href="https://wails.io">Wails v2</a>（Go）+ <a href="https://react.dev">React 18</a> 的桌面应用，
  体积小、启动快；面向 Windows 服务场景（如 Java/Spring 应用托管），同一套 Go 内核提供桌面端与 Web 形态。
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

### 🧪 JVM 诊断
- 通过 JMX 采集的 JVM 监控大盘、资源浏览、审计与诊断控制台（配套 `tools/jmx-helper`）

### 🌐 桌面 + Web 双形态

| 形态 | 说明 |
|---|---|
| 桌面端 | Wails 原生窗口（主形态，Windows） |
| Web Server | 同一界面走 HTTP / SSE，浏览器访问（实验性，支持 Docker） |

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
