import { defineConfig } from 'vitest/config'
import { poolConfig } from '@perawallet/wallet-core-devtools/vitest/pool'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['guardrails/**/__tests__/**/*.{test,spec}.ts'],
    },
    ...poolConfig,
})
