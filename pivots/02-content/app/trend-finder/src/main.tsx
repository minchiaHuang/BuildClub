import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/theme'
import App from './App.tsx'
import { ReviewPage } from './components/ReviewPage'
import { MethodPage } from './components/MethodPage'
import { reviewTokenFromPath } from './lib/share'

// Annie's link opens her page directly, outside the app shell.
const reviewToken = reviewTokenFromPath(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {reviewToken ? <ReviewPage token={reviewToken} /> : window.location.pathname === '/method' ? <MethodPage /> : <App />}
  </StrictMode>,
)
