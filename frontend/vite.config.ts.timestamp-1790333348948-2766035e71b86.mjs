// vite.config.ts
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { defineConfig } from "file:///C:/workspace/wec-service-manager/frontend/node_modules/vitest/dist/config.js";
import react from "file:///C:/workspace/wec-service-manager/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/workspace/wec-service-manager/frontend/vite.config.ts";
var dependencyPatchHash = createHash("sha256");
var dependencyPatchesUrl = new URL("./patches/", __vite_injected_original_import_meta_url);
for (const patchFile of readdirSync(dependencyPatchesUrl).filter((name) => name.endsWith(".patch")).sort()) {
  dependencyPatchHash.update(patchFile);
  dependencyPatchHash.update(readFileSync(new URL(patchFile, dependencyPatchesUrl)));
}
var dependencyPatchFingerprint = dependencyPatchHash.digest("hex");
var vite_config_default = defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./src/test/setupI18nCatalogs.ts"]
  },
  optimizeDeps: {
    // Vite only tracks the patches directory mtime. Editing an existing
    // patch-package file does not update that mtime, so make its real content
    // part of the dependency-optimizer hash and never serve a stale patch.
    esbuildOptions: {
      define: {
        __GONAVI_DEPENDENCY_PATCH_FINGERPRINT__: JSON.stringify(dependencyPatchFingerprint)
      }
    },
    // Pre-bundle startup locale modules before Wails starts proxying the WebView.
    include: [
      "antd/locale/de_DE",
      "antd/locale/en_US",
      "antd/locale/ja_JP",
      "antd/locale/ru_RU",
      "antd/locale/zh_CN",
      "antd/locale/zh_TW",
      "dayjs/locale/de",
      "dayjs/locale/ja",
      "dayjs/locale/ru",
      "dayjs/locale/zh-cn",
      "dayjs/locale/zh-tw"
    ]
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    // Let Wails discover the next available port when another Vite instance
    // is already listening on the default development port.
    strictPort: false
  },
  build: {
    outDir: "dist",
    // Standard Wails output directory
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 拆分大体积三方依赖到独立 chunk，避免主 bundle 过大
        // reactflow + dagre 约 130KB gzipped，单独成 chunk 可按需加载
        // recharts 用于诊断面板统计条，与执行计划图无强依赖，单独 chunk
        manualChunks: {
          reactflow: ["reactflow"],
          dagre: ["dagre"],
          charts: ["recharts"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFx3b3Jrc3BhY2VcXFxcd2VjLXNlcnZpY2UtbWFuYWdlclxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcd29ya3NwYWNlXFxcXHdlYy1zZXJ2aWNlLW1hbmFnZXJcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L3dvcmtzcGFjZS93ZWMtc2VydmljZS1tYW5hZ2VyL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ25vZGU6Y3J5cHRvJ1xyXG5pbXBvcnQgeyByZWFkZGlyU3luYywgcmVhZEZpbGVTeW5jIH0gZnJvbSAnbm9kZTpmcydcclxuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZXN0L2NvbmZpZydcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuY29uc3QgZGVwZW5kZW5jeVBhdGNoSGFzaCA9IGNyZWF0ZUhhc2goJ3NoYTI1NicpXHJcbmNvbnN0IGRlcGVuZGVuY3lQYXRjaGVzVXJsID0gbmV3IFVSTCgnLi9wYXRjaGVzLycsIGltcG9ydC5tZXRhLnVybClcclxuXHJcbmZvciAoY29uc3QgcGF0Y2hGaWxlIG9mIHJlYWRkaXJTeW5jKGRlcGVuZGVuY3lQYXRjaGVzVXJsKS5maWx0ZXIoKG5hbWUpID0+IG5hbWUuZW5kc1dpdGgoJy5wYXRjaCcpKS5zb3J0KCkpIHtcclxuICBkZXBlbmRlbmN5UGF0Y2hIYXNoLnVwZGF0ZShwYXRjaEZpbGUpXHJcbiAgZGVwZW5kZW5jeVBhdGNoSGFzaC51cGRhdGUocmVhZEZpbGVTeW5jKG5ldyBVUkwocGF0Y2hGaWxlLCBkZXBlbmRlbmN5UGF0Y2hlc1VybCkpKVxyXG59XHJcblxyXG5jb25zdCBkZXBlbmRlbmN5UGF0Y2hGaW5nZXJwcmludCA9IGRlcGVuZGVuY3lQYXRjaEhhc2guZGlnZXN0KCdoZXgnKVxyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgdGVzdDoge1xyXG4gICAgc2V0dXBGaWxlczogWycuL3NyYy90ZXN0L3NldHVwSTE4bkNhdGFsb2dzLnRzJ10sXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIC8vIFZpdGUgb25seSB0cmFja3MgdGhlIHBhdGNoZXMgZGlyZWN0b3J5IG10aW1lLiBFZGl0aW5nIGFuIGV4aXN0aW5nXHJcbiAgICAvLyBwYXRjaC1wYWNrYWdlIGZpbGUgZG9lcyBub3QgdXBkYXRlIHRoYXQgbXRpbWUsIHNvIG1ha2UgaXRzIHJlYWwgY29udGVudFxyXG4gICAgLy8gcGFydCBvZiB0aGUgZGVwZW5kZW5jeS1vcHRpbWl6ZXIgaGFzaCBhbmQgbmV2ZXIgc2VydmUgYSBzdGFsZSBwYXRjaC5cclxuICAgIGVzYnVpbGRPcHRpb25zOiB7XHJcbiAgICAgIGRlZmluZToge1xyXG4gICAgICAgIF9fR09OQVZJX0RFUEVOREVOQ1lfUEFUQ0hfRklOR0VSUFJJTlRfXzogSlNPTi5zdHJpbmdpZnkoZGVwZW5kZW5jeVBhdGNoRmluZ2VycHJpbnQpLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICAgIC8vIFByZS1idW5kbGUgc3RhcnR1cCBsb2NhbGUgbW9kdWxlcyBiZWZvcmUgV2FpbHMgc3RhcnRzIHByb3h5aW5nIHRoZSBXZWJWaWV3LlxyXG4gICAgaW5jbHVkZTogW1xyXG4gICAgICAnYW50ZC9sb2NhbGUvZGVfREUnLFxyXG4gICAgICAnYW50ZC9sb2NhbGUvZW5fVVMnLFxyXG4gICAgICAnYW50ZC9sb2NhbGUvamFfSlAnLFxyXG4gICAgICAnYW50ZC9sb2NhbGUvcnVfUlUnLFxyXG4gICAgICAnYW50ZC9sb2NhbGUvemhfQ04nLFxyXG4gICAgICAnYW50ZC9sb2NhbGUvemhfVFcnLFxyXG4gICAgICAnZGF5anMvbG9jYWxlL2RlJyxcclxuICAgICAgJ2RheWpzL2xvY2FsZS9qYScsXHJcbiAgICAgICdkYXlqcy9sb2NhbGUvcnUnLFxyXG4gICAgICAnZGF5anMvbG9jYWxlL3poLWNuJyxcclxuICAgICAgJ2RheWpzL2xvY2FsZS96aC10dycsXHJcbiAgICBdLFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiAnMTI3LjAuMC4xJyxcclxuICAgIHBvcnQ6IDUxNzMsXHJcbiAgICAvLyBMZXQgV2FpbHMgZGlzY292ZXIgdGhlIG5leHQgYXZhaWxhYmxlIHBvcnQgd2hlbiBhbm90aGVyIFZpdGUgaW5zdGFuY2VcclxuICAgIC8vIGlzIGFscmVhZHkgbGlzdGVuaW5nIG9uIHRoZSBkZWZhdWx0IGRldmVsb3BtZW50IHBvcnQuXHJcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6ICdkaXN0JywgLy8gU3RhbmRhcmQgV2FpbHMgb3V0cHV0IGRpcmVjdG9yeVxyXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8vIFx1NjJDNlx1NTIwNlx1NTkyN1x1NEY1M1x1NzlFRlx1NEUwOVx1NjVCOVx1NEY5RFx1OEQ1Nlx1NTIzMFx1NzJFQ1x1N0FDQiBjaHVua1x1RkYwQ1x1OTA3Rlx1NTE0RFx1NEUzQiBidW5kbGUgXHU4RkM3XHU1OTI3XHJcbiAgICAgICAgLy8gcmVhY3RmbG93ICsgZGFncmUgXHU3RUE2IDEzMEtCIGd6aXBwZWRcdUZGMENcdTUzNTVcdTcyRUNcdTYyMTAgY2h1bmsgXHU1M0VGXHU2MzA5XHU5NzAwXHU1MkEwXHU4RjdEXHJcbiAgICAgICAgLy8gcmVjaGFydHMgXHU3NTI4XHU0RThFXHU4QkNBXHU2NUFEXHU5NzYyXHU2NzdGXHU3RURGXHU4QkExXHU2NzYxXHVGRjBDXHU0RTBFXHU2MjY3XHU4ODRDXHU4QkExXHU1MjEyXHU1NkZFXHU2NUUwXHU1RjNBXHU0RjlEXHU4RDU2XHVGRjBDXHU1MzU1XHU3MkVDIGNodW5rXHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICByZWFjdGZsb3c6IFsncmVhY3RmbG93J10sXHJcbiAgICAgICAgICBkYWdyZTogWydkYWdyZSddLFxyXG4gICAgICAgICAgY2hhcnRzOiBbJ3JlY2hhcnRzJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfVxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFULFNBQVMsa0JBQWtCO0FBQ2hWLFNBQVMsYUFBYSxvQkFBb0I7QUFDMUMsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxXQUFXO0FBSCtLLElBQU0sMkNBQTJDO0FBS2xQLElBQU0sc0JBQXNCLFdBQVcsUUFBUTtBQUMvQyxJQUFNLHVCQUF1QixJQUFJLElBQUksY0FBYyx3Q0FBZTtBQUVsRSxXQUFXLGFBQWEsWUFBWSxvQkFBb0IsRUFBRSxPQUFPLENBQUMsU0FBUyxLQUFLLFNBQVMsUUFBUSxDQUFDLEVBQUUsS0FBSyxHQUFHO0FBQzFHLHNCQUFvQixPQUFPLFNBQVM7QUFDcEMsc0JBQW9CLE9BQU8sYUFBYSxJQUFJLElBQUksV0FBVyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ25GO0FBRUEsSUFBTSw2QkFBNkIsb0JBQW9CLE9BQU8sS0FBSztBQUduRSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsTUFBTTtBQUFBLElBQ0osWUFBWSxDQUFDLGlDQUFpQztBQUFBLEVBQ2hEO0FBQUEsRUFDQSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJWixnQkFBZ0I7QUFBQSxNQUNkLFFBQVE7QUFBQSxRQUNOLHlDQUF5QyxLQUFLLFVBQVUsMEJBQTBCO0FBQUEsTUFDcEY7QUFBQSxJQUNGO0FBQUE7QUFBQSxJQUVBLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUE7QUFBQTtBQUFBLElBR04sWUFBWTtBQUFBLEVBQ2Q7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBSU4sY0FBYztBQUFBLFVBQ1osV0FBVyxDQUFDLFdBQVc7QUFBQSxVQUN2QixPQUFPLENBQUMsT0FBTztBQUFBLFVBQ2YsUUFBUSxDQUFDLFVBQVU7QUFBQSxRQUNyQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
