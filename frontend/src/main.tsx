import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AISettingsProvider } from './context/AISettingsContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AISettingsProvider>
        <App />
      </AISettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
)
