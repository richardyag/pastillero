import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon.ico'],
      manifest: {
        name: 'Pastillero - Gestión de Medicamentos',
        short_name: 'Pastillero',
        description: 'Gestión inteligente de medicamentos para toda la familia',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        // Crítico: debe apuntar a la ruta donde está la app en GitHub Pages.
        // Con HashRouter la URL real es /pastillero/#/ pero el navegador
        // carga /pastillero/ y el hash lo maneja el cliente, así que esto funciona.
        start_url: '/pastillero/',
        scope: '/pastillero/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Crítico: debe ser la ruta absoluta incluyendo el base de GitHub Pages.
        // 'index.html' (relativo) hace que Workbox busque /index.html que no existe → 404.
        navigateFallback: '/pastillero/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  base: '/pastillero/'
})
