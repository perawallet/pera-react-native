import { defineConfig } from 'vitest/config'
import { coverageConfig } from '@perawallet/wallet-core-devtools/vitest/coverage'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    test: {
        coverage: coverageConfig,
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
    },
    resolve: {
        conditions: ['default'],
        alias: {
            '@test-utils': path.resolve(
                __dirname,
                '../../extensions/platform/src/test-utils',
            ),
            '@perawallet/wallet-extension-provider': path.resolve(
                __dirname,
                '../../extensions/provider/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform-driver': path.resolve(
                __dirname,
                '../../extensions/platform-driver/src/index.ts',
            ),
        },
    },
})
