import { defineConfig } from 'vitest/config'
import { coverageConfig } from '@perawallet/wallet-core-devtools/vitest/coverage'
import { poolConfig } from '@perawallet/wallet-core-devtools/vitest/pool'
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
            // Resolve to source, not dist: the browser dist externalizes
            // node `crypto`, which the mnemonic index codecs rely on.
            '@perawallet/wallet-core-kms/constants': path.resolve(
                __dirname,
                '../kms/src/constants.ts',
            ),
            '@perawallet/wallet-core-kms': path.resolve(
                __dirname,
                '../kms/src/index.ts',
            ),
            '@perawallet/wallet-extension-provider': path.resolve(
                __dirname,
                '../../extensions/provider/src/index.ts',
            ),
            '@perawallet/wallet-extension-platform-driver': path.resolve(
                __dirname,
                '../../extensions/platform-driver/src/index.ts',
            ),
            // Resolve to source, not dist: this package has no build output on
            // a fresh checkout (`dist` is gitignored and `test:unit` bypasses
            // turbo's `^build` graph).
            '@perawallet/wallet-core-passkeys': path.resolve(
                __dirname,
                '../passkeys/src/index.ts',
            ),
        },
    },
    ...poolConfig,
})
