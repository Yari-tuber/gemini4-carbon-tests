import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5176,
    host: true,
    open: false
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  }
});
