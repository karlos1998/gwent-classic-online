import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // vue-i18n esm-bundler feature flags (composition API only)
  define: {
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
