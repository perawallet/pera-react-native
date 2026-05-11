import { coverageConfig } from './coverage.js'
import { poolConfig } from './pool.js'

export const baseConfig = {
    test: {
        coverage: coverageConfig,
        globals: true,
        environment: 'jsdom',
    },
    ...poolConfig,
    resolve: {
        conditions: ['default'],
    },
}
