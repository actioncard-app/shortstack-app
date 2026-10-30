import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App'
import { BRAND } from './brand'
document.title = BRAND.name
const r = document.documentElement.style
Object.entries(BRAND.colors).forEach(([k, v]) => r.setProperty(`--${k}`, v))
r.setProperty('--gradient', BRAND.gradient)
r.setProperty('--font', BRAND.font)
createRoot(document.getElementById('root')!).render(<App />)
