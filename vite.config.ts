import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { BRAND } from './src/brand.ts'
// Title + PWA manifest come from src/brand.ts so renaming is a one-file change.
const brand = (): Plugin => ({
  name: 'brand',
  transformIndexHtml: (html) => html.replace(/<title>.*<\/title>/, `<title>${BRAND.name}</title>`).replace(/#0d0d10/g, BRAND.colors.bg),
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify({ name: BRAND.name, short_name: BRAND.shortName, description: BRAND.tagline, start_url: './', display: 'standalone', background_color: BRAND.colors.bg, theme_color: BRAND.colors.bg, icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }) })
  },
})
export default defineConfig({ plugins: [react(), brand()], base: './' })
