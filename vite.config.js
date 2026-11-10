import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Librerías en chunks propios: cambian poco y quedan cacheadas entre deploys.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Storage y Functions quedan fuera: van con la pantalla que los usa.
          if (/[\/]@?firebase[\/](storage|functions)/.test(id)) return undefined;
          if (id.includes('firebase')) return 'firebase';
          if (/[\/](react|react-dom|react-router|react-router-dom|scheduler)[\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
});
