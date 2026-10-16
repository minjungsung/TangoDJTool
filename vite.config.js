import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [VitePWA({
    registerType: 'prompt',
    manifest: {
      id: '/', name: 'Tango DJ Studio', short_name: 'Tango DJ',
      description: 'Prepare tandas, set cortina cues, and play your tango recordings.',
      start_url: '/', scope: '/', display: 'standalone', orientation: 'any',
      theme_color: '#15191e', background_color: '#15191e',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      navigateFallbackDenylist: [/^\/\.well-known\//, /^\/privacy\.html$/],
      // Update on a later launch; never reload an active DJ session automatically.
      skipWaiting: false, clientsClaim: false,
    },
  })],
});
