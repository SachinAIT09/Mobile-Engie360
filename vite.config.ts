/// <reference types="vitest/config" />
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Exposes the server's LAN address at /__demo/lan so the mobile preview can show a QR code
 * that opens the demo on a phone on the same Wi-Fi. Static hosting falls back to the page origin.
 */
function lanUrl(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use('/__demo/lan', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ urls: server.resolvedUrls?.network ?? [] }));
    });
  };
  return { name: 'demo-lan-url', configureServer: attach, configurePreviewServer: attach };
}

export default defineConfig({
  plugins: [react(), lanUrl()],
  server: { port: 5173, host: true },
  preview: { host: true },
  build: {
    rolldownOptions: {
      output: {
        // Icons are a few hundred bytes each. Left alone, every icon shared by two screens becomes its own
        // file and its own request (about twenty of them). One small file for all icons is one request.
        codeSplitting: { groups: [{ name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/ }] },
      },
    },
  },
  test: {
    include: ['src/**/*.spec.ts', 'server/**/*.spec.ts'],
    environment: 'node',
  },
});
