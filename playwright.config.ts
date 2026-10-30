import { defineConfig, devices } from '@playwright/test'
// Box-only: WebKit needs a GnuTLS GIO module we unpacked locally (no-op elsewhere).
import fs from 'node:fs'
if (!process.env.GIO_EXTRA_MODULES && fs.existsSync('/workspace/shortstack-wkdeps/gio')) process.env.GIO_EXTRA_MODULES = '/workspace/shortstack-wkdeps/gio'
if (!process.env.GST_PLUGIN_PATH && fs.existsSync('/workspace/shortstack-wkdeps/root')) process.env.GST_PLUGIN_PATH = '/workspace/shortstack-wkdeps/root/usr/lib/x86_64-linux-gnu/gstreamer-1.0'
const base = process.env.BASE_URL || 'http://localhost:4173/'
export default defineConfig({
  testDir: 'e2e', timeout: 120_000, workers: 1, retries: 0, reporter: [['list']],
  use: {
    baseURL: base, headless: true, screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] },
    permissions: ['camera', 'microphone', 'clipboard-read', 'clipboard-write'],
  },
  webServer: process.env.BASE_URL ? undefined : { command: 'npx vite preview --port 4173 --strictPort', url: base, reuseExistingServer: true },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], launchOptions: {}, permissions: [] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
  ],
})
