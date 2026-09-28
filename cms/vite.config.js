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
    // 5173 and 5174 are used by other projects on this machine, so pin ours explicitly and
    // fail loudly rather than silently sliding onto someone else's port.
    port: 5175,
    strictPort: true,
    // Vite must be allowed to read ../shared during dev.
    fs: { allow: ['..'] },
  },
});
