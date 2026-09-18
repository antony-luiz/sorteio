import { defineConfig } from 'vite'

export default defineConfig({
  // caminhos relativos: o build (dist/) funciona em qualquer pasta/servidor
  base: './',
  // host: true expõe na rede local para testar no celular (mesmo Wi-Fi)
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  // o codificador AAC em WebAssembly (~1 MB) só é baixado por navegadores sem AAC nativo
  build: { chunkSizeWarningLimit: 1100 },
})
