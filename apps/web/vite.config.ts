/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(({ mode }) => {
  const native = mode === 'android';
  return {
    base: native ? '/' : (process.env.BASE_PATH ?? '/'),
    define: {
      __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
      __BUILD_NUMBER__: JSON.stringify(
        process.env.BUILD_NUMBER ?? process.env.GITHUB_RUN_NUMBER ?? 'dev',
      ),
      __GIT_SHA__: JSON.stringify(gitSha()),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    resolve: {
      alias: {
        '@outagekit/runtime': fileURLToPath(
          new URL('../../packages/runtime/src/index.ts', import.meta.url),
        ),
      },
    },
    plugins: [
      react(),
      VitePWA({
        // The Android app ships its files inside the APK; no service worker needed there.
        disable: native,
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Outagekit',
          short_name: 'Outagekit',
          description:
            'How long will your battery run your oxygen, CPAP or ventilator? An offline runtime calculator and one-page outage plan.',
          lang: 'en',
          start_url: '.',
          scope: '.',
          display: 'standalone',
          orientation: 'any',
          background_color: '#0b1220',
          theme_color: '#0b1220',
          categories: ['medical', 'health', 'utilities'],
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,json}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
    ],
    build: {
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 900,
    },
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
    test: {
      environment: 'jsdom',
      include: ['test/**/*.test.{ts,tsx}'],
      setupFiles: ['test/setup.ts'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
        reporter: ['text', 'html', 'lcov', 'json-summary'],
      },
    },
  };
});
