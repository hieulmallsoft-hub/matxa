import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    // The portal is served by the API under /admin; use a matching asset base
    // in production so the browser loads JS/CSS from /admin/assets.
    base: process.env.VITE_BASE || (mode === 'production' ? '/admin/' : '/'),
    plugins: [react()],
    server: { port: 5174, proxy: { '/api': env.VITE_API_PROXY_TARGET || 'http://localhost:3000' } },
  };
});
