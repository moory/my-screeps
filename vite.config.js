import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'main',
      fileName: () => 'main.js',
      formats: ['cjs'], // CommonJS 格式
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`, // 保持文件名一致
      },
    },
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    target: 'esnext',
  },
})