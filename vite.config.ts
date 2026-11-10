import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sites } from '@openai/sites-vite-plugin'

const base = process.env.GITHUB_PAGES === 'true' ? '/muscle/' : '/'

export default defineConfig({
  base,
  plugins: [
    sites(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'TrainOS',
        short_name: 'TrainOS',
        description: 'Where training and nutrition work together.',
        theme_color: '#0b0d0f',
        background_color: '#080a0b',
        display: 'standalone',
        start_url: base,
        scope: base,
        orientation: 'portrait-primary',
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'sites/**/*.{test,spec}.js'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/algorithms/**/*.ts'],
    },
  },
})
