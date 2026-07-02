import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Single env file for backend + web: infra/.env
  envDir: path.resolve(__dirname, '../infra'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ['civx.xrnozy.me'],
    // Allow Firebase Google popup to communicate with the opener (Vite 6+ sets strict COOP by default).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
    proxy: { '/api': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth'],
          maps: ['@googlemaps/js-api-loader', '@googlemaps/markerclusterer'],
          charts: ['recharts'],
          qr: ['html5-qrcode', 'qrcode'],
        },
      },
    },
  },
});
