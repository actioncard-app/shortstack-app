// ONE place for the app's name and look. Swap these to rename (e.g. HollerClips, PorchClips, Tambay).
// Font must be free (OFL) and is self-hosted via @fontsource; change the import in main.tsx if you switch it.
export const BRAND = {
  name: 'ShortStack',
  tagline: 'Short videos. Clear rules. Fair pay.',
  logoText: 'ShortStack',
  shortName: 'ShortStack',
  font: "'Plus Jakarta Sans Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  colors: { primary: '#ff4d4f', accent: '#ffc53d', bg: '#08080b', surface: '#16161c', surface2: '#202029', text: '#f7f7fa', muted: '#a3a3b2', like: '#ff2d55' },
  gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 45%, #ffc53d 100%)',
} as const

export const COMMUNITIES = [
  { id: 'veterans', label: 'Veterans', emoji: '🎖️' },
  { id: 'travel', label: 'Travel', emoji: '🧭' },
  { id: 'appalachia', label: 'Appalachia', emoji: '⛰️' },
  { id: 'philippines', label: 'Philippines', emoji: '🌴' },
] as const

export const LIMITS = { maxSeconds: 60, maxBytes: 25 * 1024 * 1024 }
