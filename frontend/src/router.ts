import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/offline', name: 'offline', component: () => import('./views/OfflineGame.vue') },
    { path: '/online', name: 'online', component: () => import('./views/OnlineView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
