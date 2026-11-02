import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { readdirSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'

// Discover the real public files at build time so newly added cards cannot be missed.
const publicDir = fileURLToPath(new URL('./public', import.meta.url))
const preloadAssets = readdirSync(publicDir, { recursive: true })
  .map(String)
  .filter((path) => /^(img|svg|sfx)\//.test(path) && /\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav)$/i.test(path))
  .sort()
  .map((path) => '/' + path.replaceAll('\\', '/'))

export default defineConfig({
  plugins: [vue()],
  // vue-i18n esm-bundler feature flags (composition API only)
  define: {
    __GWENT_PRELOAD_ASSETS__: JSON.stringify(preloadAssets),
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  preview: { port: 47318, strictPort: true },
  server: {
    port: 47317,
    strictPort: true, // fail instead of silently picking another port
    // Spring Boot backend of the online mode (gwent.server.port / GWENT_SERVER_PORT)
    proxy: {
      '/api': { target: 'http://localhost:47321', changeOrigin: false },
      '/ws': { target: 'ws://localhost:47321', ws: true },
    },
  },
})
