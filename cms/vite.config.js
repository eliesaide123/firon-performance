import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // CONTRACT §11.3 — the shared service layer lives outside this package root.
      '@firon/shared': path.resolve(import.meta.dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    // Vite must be allowed to read ../shared during dev.
    fs: { allow: ['..'] },
  },
});
