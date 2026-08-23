import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const classicRuntimeAssets = [
  'core-system.js',
  'auth-secure-system.js',
  'users-migration-ui.js',
  'ui-system.js',
  'reports-system.js',
  'fuel-system.js',
  'export-system.js',
  'main-app.js',
  'theme.css',
  'layout.css',
  'components.css',
  'redesign.css'
];

function copyClassicRuntimeAssets() {
  return {
    name: 'copy-classic-waterdash-runtime-assets',
    closeBundle() {
      const outputDirectory = resolve(process.cwd(), 'dist', 'assets');
      mkdirSync(outputDirectory, { recursive: true });
      for (const asset of classicRuntimeAssets) {
        copyFileSync(resolve(process.cwd(), 'assets', asset), resolve(outputDirectory, asset));
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    copyClassicRuntimeAssets(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'WaterDash - Pumping Operations',
        short_name: 'WaterDash',
        description: 'Water Pumping & Daily Operation Dashboard',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        dir: 'rtl',
        // No icon files exist in the source repository; omit manifest icons
        // rather than generating references to missing runtime assets.
        icons: []
      }
    })
  ]
});
