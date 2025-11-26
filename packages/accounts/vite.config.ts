import { defineConfig } from 'vite'
import { resolve } from 'path'
export default defineConfig({
    plugins: [],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: 'index',
        },
        rollupOptions: {
            external: [
                'react',
                'react/jsx-runtime',
                'zustand',
                '@tanstack/react-query',
                '@perawallet/wallet-core-shared',
                '@perawallet/storage',
                '@perawallet/wallet-core-xhdwallet',
                'uuid',
                'bip39',
            ],
        },
    },
})
