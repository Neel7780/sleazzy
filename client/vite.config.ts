import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = process.env.NODE_ENV === 'production' || mode === 'production';
    
    return {
      base: isProduction ? '/sleazzy/' : '/',
      server: {
        port: 3000,
        host: 'localhost',
      },
      plugins: [react(), tailwindcss()],
      define: {
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
