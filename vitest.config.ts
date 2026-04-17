import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/__tests__/*.{test,spec}.ts?(x)'],
        exclude: ['packages/core/src/api/generated/**', 'node_modules', 'dist'],
        setupFiles: ['vitest.setup.ts'],
    },
    resolve: {
        alias: {
            '~': path.resolve(__dirname, 'packages/core/src'),
        },
    },
})
