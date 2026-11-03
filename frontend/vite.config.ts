/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    server: {
        port: 5173,
        // Same-origin in dev too, so what runs here is what runs behind nginx on the Pi. The
        // rewrite mirrors nginx.conf: the backend mounts its routers at bare paths (/hello,
        // /health, …), so the /api marker is ours and is stripped here.
        proxy: {
            '/api': {
                target: 'http://localhost:3010',
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/api/, ''),
            },
        },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        include: ['tests/**/*.test.{ts,tsx}'],
    },
});
