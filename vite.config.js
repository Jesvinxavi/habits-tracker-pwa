import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Dynamically set base path for local/dev vs GitHub Pages
const isProd = process.env.NODE_ENV === 'production';
const repoName = 'habits-tracker-pwa'; // Updated to match actual repo name
const base = isProd ? `/${repoName}/` : '/'; // '/' for local, '/repo-name/' for GitHub Pages
const iconsBase = base.endsWith('/') ? base + 'icons/' : base + '/icons/';

export default defineConfig({
  base: base, // Use the dynamically calculated base
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      includeAssets: ['favicon.svg', 'masked-icon.svg'],
      manifest: {
        name: 'Healthy Habits Tracker',
        short_name: 'Habits',
        description: 'Track your daily habits and fitness activities',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: iconsBase + 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: iconsBase + 'apple-touch-icon-120x120.png',
            sizes: '120x120',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vite'],
        },
      },
      external: ['fsevents'], // Ignore fsevents for macOS compatibility
    },
  },
  optimizeDeps: {
    include: [],
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 8100,
    open: true,
  },
});
