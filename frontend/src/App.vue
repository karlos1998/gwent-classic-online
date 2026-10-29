<template>
  <RouterView />
  <LanguageSwitcher />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import LanguageSwitcher from './ui/components/LanguageSwitcher.vue'

export default defineComponent({ name: 'App', components: { LanguageSwitcher } })
</script>
