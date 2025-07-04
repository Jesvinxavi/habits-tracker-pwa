import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      manifestFilename: 'assets/manifest.json',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,json}'],
      },
    }),
  ],
  server: {
    hmr: {
      overlay: true,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});
