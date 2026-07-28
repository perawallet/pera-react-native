import { describe, test, expect } from 'vitest'
import check from '../checks/restrict-pera-service-fallback-importers.check.js'
import { runCheckOnSource } from './helpers.js'

describe('restrict-pera-service-fallback-importers', () => {
    const IMPORT = `import { resolvePeraServiceLane } from './pera-service-fallback'\n`

    test('allows the config network-config importer', () => {
        expect(
            runCheckOnSource(
                check,
                '/repo/packages/config/src/network-config.ts',
                IMPORT,
            ),
        ).toHaveLength(0)
    })

    test('allows the shared query-client importer', () => {
        expect(
            runCheckOnSource(
                check,
                '/repo/packages/shared/src/api/query-client.ts',
                `import { hasPeraServiceFallback } from '@perawallet/wallet-core-config'\nimport { PERA_SERVICE_FALLBACK } from '@perawallet/wallet-core-config'\n`,
            ),
        ).toHaveLength(0)
    })

    test('flags a new importer', () => {
        const violations = runCheckOnSource(
            check,
            '/repo/packages/swaps/src/hooks/useSwapQuote.ts',
            `import { resolvePeraServiceLane } from '@perawallet/wallet-core-config'\n`,
        )

        expect(violations).toHaveLength(1)
        expect(violations[0].message).toMatch(/pera-service-fallback/)
    })

    test('ignores unrelated config imports', () => {
        expect(
            runCheckOnSource(
                check,
                '/repo/packages/swaps/src/hooks/useSwapQuote.ts',
                `import { getNetworkConfig } from '@perawallet/wallet-core-config'\n`,
            ),
        ).toHaveLength(0)
    })
})
