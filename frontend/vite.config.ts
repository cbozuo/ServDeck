import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const dependencyPatchHash = createHash('sha256')
const dependencyPatchesUrl = new URL('./patches/', import.meta.url)

for (const patchFile of readdirSync(dependencyPatchesUrl).filter((name) => name.endsWith('.patch')).sort()) {
  dependencyPatchHash.update(patchFile)
  dependencyPatchHash.update(readFileSync(new URL(patchFile, dependencyPatchesUrl)))
}

const dependencyPatchFingerprint = dependencyPatchHash.digest('hex')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./src/test/setupI18nCatalogs.ts'],
  },
  optimizeDeps: {
    // Vite only tracks the patches directory mtime. Editing an existing
    // patch-package file does not update that mtime, so make its real content
    // part of the dependency-optimizer hash and never serve a stale patch.
    esbuildOptions: {
      define: {
        __GONAVI_DEPENDENCY_PATCH_FINGERPRINT__: JSON.stringify(dependencyPatchFingerprint),
      },
    },
    // Pre-bundle startup locale modules before Wails starts proxying the WebView.
    include: [
      'antd/locale/de_DE',
      'antd/locale/en_US',
      'antd/locale/ja_JP',
      'antd/locale/ru_RU',
      'antd/locale/zh_CN',
      'antd/locale/zh_TW',
      'dayjs/locale/de',
      'dayjs/locale/ja',
      'dayjs/locale/ru',
      'dayjs/locale/zh-cn',
      'dayjs/locale/zh-tw',
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Let Wails discover the next available port when another Vite instance
    // is already listening on the default development port.
    strictPort: false,
  },
  build: {
    outDir: 'dist', // Standard Wails output directory
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // 拆分大体积三方依赖到独立 chunk，避免主 bundle 过大
        // reactflow + dagre 约 130KB gzipped，单独成 chunk 可按需加载
        // recharts 用于诊断面板统计条，与执行计划图无强依赖，单独 chunk
        manualChunks: {
          reactflow: ['reactflow'],
          dagre: ['dagre'],
          charts: ['recharts'],
        },
      },
    },
  }
})
