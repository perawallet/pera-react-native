import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
        coverage: {
            provider: 'v8',
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/__tests__/**',
                '**/models/**',
                '**/index.ts',
                '**/*.config.ts',
                '**/eslint.config.js',
            ],
        },
    },
    resolve: {
        conditions: ['default'],
    },
})
