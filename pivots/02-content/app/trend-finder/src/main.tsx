import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MethodPage } from './components/MethodPage'
import { SharedReviewPage } from './components/SharedReviewPage'
import { reviewTokenFromPath } from './lib/share'

// The static "how we calculate" note opens at /method, outside the app shell.
const isMethod = window.location.pathname === '/method'
// The approver's link, /review/<token>, opens a page of its own: no sign-in, no sidebar.
const reviewToken = reviewTokenFromPath(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMethod ? <MethodPage /> : reviewToken ? <SharedReviewPage token={reviewToken} /> : <App />}
  </StrictMode>,
)
