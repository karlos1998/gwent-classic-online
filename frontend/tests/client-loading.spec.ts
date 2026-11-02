import { readdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// Model YouTube's documented ready/blocked/state events deterministically.
// External playback availability is checked separately in a real browser.
async function mockMusic(page: Page, enabled = 'true') {
  await page.addInitScript((preference) => {
    performance.setResourceTimingBufferSize(2000)
    if (!localStorage.getItem('gc-music')) localStorage.setItem('gc-music', preference)
    localStorage.setItem('gc-locale', 'pl')
  }, enabled)
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.__musicTest = { instances: 0, plays: 0, pauses: 0, blocked: true };
      window.YT = { Player: class {
        constructor(id, options) {
          this.events = options.events;
          window.__musicTest.instances++;
          const iframe = document.createElement('iframe');
          iframe.id = id;
          document.getElementById(id).replaceWith(iframe);
          setTimeout(() => this.events.onReady(), 0);
        }
        playVideo() {
          window.__musicTest.plays++;
          if (window.__musicTest.blocked) this.events.onAutoplayBlocked();
          else this.events.onStateChange({ data: 1 });
        }
        pauseVideo() { window.__musicTest.pauses++; this.events.onStateChange({ data: 2 }); }
        destroy() { document.getElementById('youtube')?.remove(); }
      }};
      window.onYouTubeIframeAPIReady();
    `,
  }))
}

async function settings(page: Page) {
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click()
  return page.getByRole('menuitemcheckbox', { name: 'Muzyka', exact: true })
}

test('cold entry waits for weather artwork and prepares every card before showing the menu', async ({ page }) => {
  await mockMusic(page)
  let release!: () => void
  const held = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/img/icons/overlay_frost.png', async (route) => {
    await held
    await route.continue()
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(page.getByRole('link', { name: /Graj z komputerem/ })).toHaveCount(0)
  release()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  const files = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => new URL(entry.name).pathname))
  expect(files).toContain('/img/icons/overlay_frost.png')
  const artwork = readdirSync(new URL('../public/img/', import.meta.url), { recursive: true })
    .map(String).filter((path) => /\.(png|jpe?g|gif|webp|svg)$/.test(path))
  for (const path of artwork) expect(files).toContain('/img/' + path)
  expect(files).toContain('/sfx/frost.mp3')
  await page.getByRole('link', { name: /Graj z komputerem/ }).click()
  await expect(page.locator('#deck-customization')).toBeVisible()
})

test('failed asset keeps the game gated and retry reloads only missing files', async ({ page }) => {
  await mockMusic(page)
  let attempts = 0
  let boardLoads = 0
  page.on('request', (request) => { if (request.url().endsWith('/img/board.jpg')) boardLoads++ })
  await page.route('**/img/icons/overlay_rain.png', (route) => {
    attempts++
    return attempts === 1 ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue()
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Ponów ładowanie' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Graj z komputerem/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Ponów ładowanie' }).click()
  await expect(page.getByRole('link', { name: /Graj z komputerem/ })).toBeVisible()
  expect(attempts).toBe(2)
  expect(boardLoads).toBe(1)
})

test('blocked autoplay preserves preference, first click retries, player survives route changes', async ({ page }) => {
  await mockMusic(page)
  await page.goto('/')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  const toggle = await settings(page)
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Kliknij, aby zezwolić na odtwarzanie muzyki')).toBeVisible()
  await page.evaluate('window.__musicTest.blocked = false')
  await page.getByRole('button', { name: 'Kliknij, aby zezwolić na odtwarzanie muzyki' }).click()
  await expect(page.getByText('Kliknij, aby zezwolić na odtwarzanie muzyki')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate(() => localStorage.getItem('gc-music'))).toBe('false')
  await toggle.click()
  await page.getByRole('link', { name: /Graj z komputerem/ }).click()
  await expect(page.locator('#deck-customization')).toBeVisible()
  await page.goBack()
  await page.getByRole('link', { name: /Graj z komputerem/ }).click()
  expect(await page.evaluate('window.__musicTest.instances')).toBe(1)
  await expect(page.locator('#music-host iframe')).toHaveCount(1)
})

test('explicitly disabled music remains disabled after reload', async ({ page }) => {
  await mockMusic(page, 'false')
  await page.goto('/offline')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(await settings(page)).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate('window.__musicTest.plays')).toBe(0)
  await page.reload()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(await settings(page)).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate('window.__musicTest.plays')).toBe(0)
})
