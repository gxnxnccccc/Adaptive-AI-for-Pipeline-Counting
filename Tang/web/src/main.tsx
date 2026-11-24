import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
// Self-hosted fonts (offline demo room): Anuphan body, Mitr display, Spline Sans Mono for numbers/IDs.
import '@fontsource/anuphan/400.css'
import '@fontsource/anuphan/500.css'
import '@fontsource/anuphan/600.css'
import '@fontsource/anuphan/700.css'
import '@fontsource/anton/400.css' // Login headline; free stand-in for Sublime Bold Condensed (see index.css --font-brand)
import '@fontsource/mitr/500.css'
import '@fontsource/mitr/600.css'
import '@fontsource/spline-sans-mono/400.css'
import '@fontsource/spline-sans-mono/500.css'
import '@fontsource/spline-sans-mono/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
