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
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
