import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Where a build is going has to be stated, never guessed.
 *
 * The app is served from a subpath on GitHub Pages (/<repo>/) and from the root
 * on a local server. That path is baked into index.html at build time, so a
 * build made for one and served from the other 404s every stylesheet and script
 * — the page renders as bare unstyled HTML that never finishes loading. Guessing
 * the target from NODE_ENV caused exactly that, because `vite build` sets
 * NODE_ENV=production itself: every plain `npm run build` silently produced a
 * Pages build.
 *
 * So: `vite build` requires BUILD_TARGET, and refuses to guess.
 *
 *   BUILD_TARGET=pages  → base /<repo>/, service worker on   (npm run build:pages)
 *   BUILD_TARGET=local  → base /,        service worker off  (npm run build:local)
 *
 * Dev and preview servers do not need it: they always serve from the root.
 */
const TARGETS = ['pages', 'local'];

const REPO_NAME =
  process.env.REPO_NAME ||
  (process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '') ||
  'habits-tracker-pwa';

/**
 * Resolves the build target, failing loudly rather than picking one.
 * @param {string} command Vite's command: 'build' or 'serve'.
 * @returns {string} 'pages' or 'local'.
 */
function resolveTarget(command) {
  const target = process.env.BUILD_TARGET;

  // Dev and preview serve from the root, so they need no target.
  if (command !== 'build') return 'local';

  if (!TARGETS.includes(target)) {
    throw new Error(
      [
        '',
        `Refusing to build: BUILD_TARGET must be "pages" or "local"${target ? `, not "${target}"` : ' and is unset'}.`,
        '',
        '  npm run build:pages   deploy to GitHub Pages   → base /' + REPO_NAME + '/',
        '  npm run build:local   run on a local server    → base /, no service worker',
        '  npm run preview:local builds local and serves it on http://localhost:4180',
        '  npm run preview:phone same, reachable from your phone on this Wi-Fi',
        '',
        '  See docs/operations/BUILD_AND_DEPLOY.md.',
        '',
      ].join('\n')
    );
  }
  return target;
}

export default defineConfig(({ command }) => {
  const explicitPwaTestBuild =
    process.env.PWA_TEST_BUILD === '1' &&
    process.env.VITE_PWA_TEST === '1';
  if (
    command === 'build' &&
    process.env.VITE_TEST_HARNESS === '1' &&
    !explicitPwaTestBuild
  ) {
    throw new Error(
      'Refusing to build with VITE_TEST_HARNESS=1 outside the explicit PWA test build.'
    );
  }
  const target = resolveTarget(command);
  const isPages = target === 'pages';
  const base = isPages ? `/${REPO_NAME}/` : '/';
  const iconsBase = `${base}icons/`;

  if (command === 'build') {
    // Printed on every build, so the target is never a mystery afterwards.
    // eslint-disable-next-line no-console
    console.warn(
      `\n▸ Building for ${target.toUpperCase()} — base "${base}", service worker ${isPages ? 'ON' : 'OFF'}\n`
    );
  }

  return {
    base: base,
    plugins: [
      VitePWA({
        // A stale service worker keeps serving an old build long after the files
        // on disk change, which is indistinguishable from "my fix did nothing".
        // Local builds are for looking at the current code, so they get none.
        disable: !isPages,
        // The application owns activation so a waiting worker cannot reload a
        // client with pending offline work or an open editor.
        registerType: 'prompt',
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
          manualChunks(id) {
            if (id.includes('/src/features/habits/modals/')) return 'habits-modals';
            if (id.includes('/src/features/habits/')) return 'habits-core';
            // Fitness dialogs and the timer are real interaction boundaries.
            // Let Rollup preserve their dynamic-import chunks instead of forcing
            // every dialog back into one eager feature bundle.
            if (
              id.includes('/src/features/fitness/Modals/') ||
              id.includes('/src/features/fitness/TimerModule.js')
            ) {
              return undefined;
            }
            if (id.includes('/src/features/fitness/')) return 'fitness-core';
            if (
              id.includes('/src/shared/common.js') ||
              id.includes('/src/shared/datetime.js') ||
              id.includes('/src/shared/constants.js') ||
              id.includes('/src/features/holidays/holidays.js')
            ) {
              return 'utils';
            }
            if (
              id.includes('/src/components/') ||
              id.includes('/src/shared/HeaderBar.js') ||
              id.includes('/src/shared/ActionButtons.js')
            ) {
              return 'components';
            }
            return undefined;
          },
          chunkFileNames: (chunkInfo) => {
            const facadeName = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop().replace('.js', '')
              : null;
            return `assets/${chunkInfo.name || facadeName || 'chunk'}-[hash].js`;
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
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: ['MacBook-Pro.local'],
      open: true,
    },
    preview: {
      port: 4180,
      open: false,
    },
  };
});
