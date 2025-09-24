import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@components': resolve(__dirname, 'src/components'),
            '@screens': resolve(__dirname, 'src/screens'),
            '@layouts': resolve(__dirname, 'src/layouts'),
            '@routes': resolve(__dirname, 'src/routes'),
            '@theme': resolve(__dirname, 'src/theme'),
            '@test-utils': resolve(__dirname, 'src/test-utils'),
        },
    },
    test: {
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        environment: 'jsdom',
        coverage: {
            provider: 'v8',
            all: true,
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/**/*.d.ts',
                'src/**/__tests__/**',
                'src/**/__mocks__/**',
                'src/**/__fixtures__/**',
                'src/**/*.test.{ts,tsx}',
                'src/**/*.spec.{ts,tsx}',
                'src/**/index.ts',
                'src/test-utils/**',
                'src/**/*.style.ts',
                'src/**/*.styles.ts',
            ],
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: './coverage',
            thresholds: {
                global: {
                    branches: 70,
                    functions: 70,
                    lines: 70,
                    statements: 70,
                },
            },
        },
    },
})