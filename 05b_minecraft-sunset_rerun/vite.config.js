import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5188,
    open: false
  },
  build: {
    target: 'esnext',
    outDir: 'dist'
  }
});
