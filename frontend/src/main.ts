import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import './assets/gwent.css'

// Coroutines of a game that was quit mid-turn are cancelled with GameAborted - that's expected.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.name === 'GameAborted') e.preventDefault()
})

createApp(App).use(i18n).use(router).mount('#app')
