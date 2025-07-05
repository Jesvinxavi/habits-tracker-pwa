import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Healthy Habits Tracker',
        short_name: 'Habits',
        description: 'Track your daily habits and build a healthier lifestyle',
        theme_color: '#007AFF',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'assets/icons/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'assets/icons/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'assets/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Feature-specific chunks
          'habits-core': [
            './src/habits/HabitsModule.js',
            './src/habits/HabitsView.js',
            './src/habits/HabitsListModule.js',
          ],
          'habits-modals': [
            './src/habits/modals/HabitFormModal.js',
            './src/habits/modals/HabitReorderModal.js',
            './src/habits/modals/HabitIconPicker.js',
          ],
          'fitness-core': [
            './src/fitness/FitnessModule.js',
            './src/fitness/FitnessView.js',
            './src/fitness/ActivityListModule.js',
          ],
          'fitness-modals': [
            './src/fitness/Modals/ActivityDetailsModal.js',
            './src/fitness/Modals/AddEditActivityModal.js',
            './src/fitness/Modals/StatsModal.js',
          ],
          'utils': [
            './src/utils/common.js',
            './src/utils/datetime.js',
            './src/utils/constants.js',
            './src/utils/holidays.js',
          ],
          'components': [
            './src/components/Modal.js',
            './src/components/ConfirmDialog.js',
            './src/components/InstallPrompt.js',
            './src/components/UpdatePrompt.js',
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
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
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
