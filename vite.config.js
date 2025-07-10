import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Dynamically set base path for local/dev vs GitHub Pages
const isProd = process.env.NODE_ENV === 'production';
const repoName = 'healthy-habits-tracker'; // Change if your repo name is different
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
        description: 'Track your daily habits and build a healthier lifestyle',
        theme_color: '#007AFF',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: iconsBase + 'apple-touch-icon.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: iconsBase + 'apple-touch-icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: iconsBase + 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Feature-specific chunks
          'habits-core': [
            './src/features/habits/HabitsModule.js',
            './src/features/habits/HabitsView.js',
            './src/features/habits/HabitsListModule.js',
          ],
          'habits-modals': [
            './src/features/habits/modals/HabitFormModal.js',
            './src/features/habits/modals/HabitReorderModal.js',
            './src/features/habits/modals/HabitIconPicker.js',
          ],
          'fitness-core': [
            './src/features/fitness/FitnessModule.js',
            './src/features/fitness/FitnessView.js',
          ],
          'fitness-modals': [
            './src/features/fitness/Modals/ActivityDetailsModal.js',
            './src/features/fitness/Modals/AddEditActivityModal.js',
            './src/features/fitness/Modals/StatsModal.js',
          ],
          utils: [
            './src/shared/common.js',
            './src/shared/datetime.js',
            './src/shared/constants.js',
            './src/features/holidays/holidays.js',
          ],
          components: [
            './src/components/Modal.js',
            './src/components/ConfirmDialog.js',
            './src/components/InstallPrompt.js',
            './src/components/UpdatePrompt.js',
            './src/shared/HeaderBar.js',
            './src/shared/ActionButtons.js',
          ],
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace('.js', '')
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
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
