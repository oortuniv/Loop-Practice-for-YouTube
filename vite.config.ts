import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  esbuild: {
    target: 'es2020'
  },
  build: {
    rollupOptions: {
      input: {
        content: 'src/content/index.ts',
        background: 'src/background.ts'
      }
    }
  }
}); 