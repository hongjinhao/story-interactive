import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { startingTheme } from './themes.ts'

// Pick the theme and switch the CSS variables before React's first render, so the page never
// shows in the wrong theme first (SPECS-2 R11).
const theme = startingTheme(new Date())
document.documentElement.dataset.theme = theme.id

createRoot(document.getElementById('root')!).render(<App initialTheme={theme} />)
