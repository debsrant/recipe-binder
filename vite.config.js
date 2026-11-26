import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Recipe Binder',
        short_name: 'Recipes',
        description: 'Offline-first cross-device digital kitchen recipe binder.',
        theme_color: '#254b69',
        background_color: '#d5cfc3',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  server: {
    port: 5176,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
});
