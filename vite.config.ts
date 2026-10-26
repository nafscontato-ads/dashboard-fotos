import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// cada deploy ganha um número; o app instalado compara com version.json e se atualiza sozinho
const BUILD = String(Date.now())
const version = (): Plugin => ({
  name: 'version-json',
  apply: 'build',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }) },
})

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), tailwindcss(), version()],
})
