import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
const t = 'http://localhost:4000';
export default defineConfig({ plugins: [react(), tailwind()], server: { proxy: { '/api': t, '/auth': t, '/admin': t } } });
