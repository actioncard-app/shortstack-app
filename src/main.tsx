import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BRAND } from './brand'
document.title = BRAND.name
const r = document.documentElement.style
Object.entries(BRAND.colors).forEach(([k, v]) => r.setProperty(`--${k}`, v))
createRoot(document.getElementById('root')!).render(<App />)
