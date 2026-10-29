<template>
  <div class="home online-entry">
    <div class="home-bg"></div>
    <form class="home-content nick-form" novalidate @submit.prevent="submit">
      <p class="home-kicker">{{ $t('online.kicker') }}</p>
      <h1 class="home-title">{{ $t('online.title') }}</h1>
      <p class="home-sub">{{ $t('online.nickname.subtitle') }}</p>

      <label class="nick-label" for="nickname">{{ $t('online.nickname.label') }}</label>
      <div class="nick-field" :class="{ invalid: showError, valid: !error && value }">
        <input
          id="nickname"
          ref="input"
          v-model="value"
          type="text"
          autocomplete="nickname"
          spellcheck="false"
          :maxlength="NICKNAME_MAX * 2"
          :placeholder="$t('online.nickname.placeholder')"
          :aria-invalid="showError"
          aria-describedby="nick-hint"
          @blur="touched = true"
        />
        <span class="nick-count">{{ length }}/{{ NICKNAME_MAX }}</span>
      </div>
      <p id="nick-hint" class="nick-hint" :class="{ error: showError || !!serverError }" role="status">
        {{ message }}
      </p>

      <button class="nick-submit" type="submit" :disabled="!!error || online.signingIn" @mouseenter="hoverSFX">
        {{ $t(online.signingIn ? 'online.nickname.joining' : 'online.nickname.submit') }}
      </button>

      <p class="nick-note">{{ $t('online.nickname.guestNote') }}</p>
      <RouterLink to="/" class="mode back">{{ $t('online.back') }}</RouterLink>
    </form>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { checkNickname, NICKNAME_MAX } from '../nickname'
import { online } from '../session'
import { hoverSFX } from '@/ui/audio'
import { t } from '@/i18n'

export default defineComponent({
  name: 'NicknameForm',
  setup() {
    const value = ref('')
    const touched = ref(false)
    const input = ref<HTMLInputElement | null>(null)
    const error = computed(() => checkNickname(value.value))
    const length = computed(() => [...value.value.normalize('NFKC')].length)
    const showError = computed(() => !!error.value && (touched.value || value.value.length > 0) && error.value !== 'nickname.required')
    const serverError = computed(() => online.signInError)

    // a new attempt clears the previous server answer ("nickname taken" ...)
    watch(value, () => (online.signInError = null))

    const message = computed(() => {
      if (serverError.value) return t(serverError.value)
      if (showError.value) return t('errors.' + error.value)
      return t('online.nickname.rules')
    })

    const submit = () => {
      touched.value = true
      if (error.value) return
      // the server validates again and checks that the nickname is free
      online.signIn(value.value.normalize('NFKC'))
    }

    onMounted(() => input.value?.focus())

    return { value, touched, input, error, length, showError, serverError, message, submit, online, hoverSFX, NICKNAME_MAX }
  },
})
</script>

<style>
.nick-form {
  width: min(92vw, 520px);
}
.nick-label {
  display: block;
  text-align: left;
  margin-bottom: 8px;
  color: #c9a14a;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.8em;
}
.nick-field {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(14, 12, 10, 0.92);
  border: 2px solid #3a2e14;
  box-shadow: 0 0 0.6em #6d5210 inset, 0 0 0.6em rgba(0, 0, 0, 0.6);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.nick-field:focus-within {
  border-color: #9f7d3e;
  box-shadow: 0 0 1.2em rgba(218, 165, 32, 0.25) inset, 0 0 1em rgba(109, 82, 16, 0.8);
}
.nick-field.invalid {
  border-color: #8b2a1d;
}
.nick-field.valid {
  border-color: #6d5210;
}
.nick-field input {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  font: inherit;
  font-size: 1.35em;
  color: goldenrod;
  background: transparent;
  border: 0;
  outline: none;
}
.nick-field input::placeholder {
  color: #5f5241;
}
.nick-count {
  padding-right: 14px;
  color: #6f6150;
  font-size: 0.85em;
  font-variant-numeric: tabular-nums;
}
.nick-hint {
  min-height: 2.6em;
  margin: 10px 0 18px;
  text-align: left;
  color: #8f8068;
  font-size: 0.9em;
  line-height: 1.35;
}
.nick-hint.error {
  color: #e0664f;
}
.nick-submit {
  width: 100%;
  padding: 14px;
  font: inherit;
  font-size: 1.3em;
  font-weight: bold;
  letter-spacing: 0.06em;
  color: goldenrod;
  background: linear-gradient(#2a2216, #15110b);
  border: 2px solid #6d5210;
  cursor: pointer;
  box-shadow: 0 0 0.6em #6d5210;
  transition: box-shadow 0.15s, transform 0.15s, opacity 0.15s;
}
.nick-submit:hover:not(:disabled) {
  box-shadow: 0 0 1.6em #9f7d3e;
  transform: translateY(-1px);
}
.nick-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.nick-note {
  margin: 18px 0 22px;
  color: #82735f;
  font-size: 0.82em;
}
</style>
