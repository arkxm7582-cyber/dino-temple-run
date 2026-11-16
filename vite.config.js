import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
