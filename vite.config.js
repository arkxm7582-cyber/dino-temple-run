import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backup route for the Fish API. The game normally calls the API directly
// (it allows other websites with CORS). If that is blocked, it calls
// '/fish-api/api.php' on its own address, and Vite passes it on:
//   /fish-api/api.php  ->  https://www.marcconrad.com/uob/fish/api.php
// (server/server.js does the same job for the finished game.)
const fishProxy = {
  '/fish-api': {
    target: 'https://www.marcconrad.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/fish-api/, '/uob/fish'),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: fishProxy },
  preview: { port: 4173, proxy: fishProxy },
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
