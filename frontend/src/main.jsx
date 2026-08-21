import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.jsx'

// Configure global Axios baseURL from environment variable or live production backend fallback
const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://datalyze-96cc.onrender.com' : '');
if (apiBase) {
  axios.defaults.baseURL = apiBase.replace(/\/$/, '');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
