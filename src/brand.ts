// ONE place for the app's name and look. Swap these to rename (e.g. HollerClips, PorchClips, Tambay).
export const BRAND = {
  name: 'ShortStack',
  tagline: 'Short videos. Clear rules. Fair pay.',
  logoText: 'ShortStack',
  shortName: 'ShortStack',
  colors: { primary: '#ff5a36', accent: '#ffd23f', bg: '#0d0d10', surface: '#1a1a20', text: '#f5f5f7', muted: '#9a9aa5' },
} as const

export const COMMUNITIES = [
  { id: 'veterans', label: 'Veterans' },
  { id: 'travel', label: 'Travel' },
  { id: 'appalachia', label: 'Appalachia' },
  { id: 'philippines', label: 'Philippines' },
] as const

export const LIMITS = { maxSeconds: 60, maxBytes: 25 * 1024 * 1024 }
