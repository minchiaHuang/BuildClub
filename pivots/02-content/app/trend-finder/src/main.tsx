import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MethodPage } from './components/MethodPage'

// The static "how we calculate" note opens at /method, outside the app shell.
const isMethod = window.location.pathname === '/method'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMethod ? <MethodPage /> : <App />}
  </StrictMode>,
)
