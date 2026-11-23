import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  worker: {
    format: 'es'
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        converter: resolve(__dirname, 'converter.html'),
        scripts: resolve(__dirname, 'scripts.html')
      }
    }
  }
});