import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// iPhone: bloqueia o zoom de pinça (o duplo toque já é bloqueado pelo touch-action no CSS)
document.addEventListener('gesturestart', (e) => e.preventDefault())

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // confere se saiu versão nova: ao abrir, ao voltar pro app e a cada 2 minutos
    const check = async () => {
      try {
        const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
        const { build } = await r.json()
        if (build && build !== __BUILD__) {
          // evita ficar recarregando em loop se o servidor ainda não terminou de publicar
          if (sessionStorage.getItem('reloaded-for') === build) return
          sessionStorage.setItem('reloaded-for', build)
          await reg.update().catch(() => {})
          location.reload()
        }
      } catch { /* sem internet */ }
    }
    check()
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    setInterval(() => document.visibilityState === 'visible' && check(), 120000)
  })
}
