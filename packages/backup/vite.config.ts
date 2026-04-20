import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
    plugins: [
        dts({
            include: ['src'],
            exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
            afterDiagnostic: diagnostics => {
                if (diagnostics.length > 0) {
                    throw new Error(
                        `TypeScript declaration generation failed with ${diagnostics.length} error(s)`,
                    )
                }
            },
        }),
    ],
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
                '@perawallet/wallet-core-accounts',
                '@perawallet/wallet-core-config',
                '@perawallet/wallet-core-shared',
                '@perawallet/wallet-extension-provider',
            ],
        },
    },
})
