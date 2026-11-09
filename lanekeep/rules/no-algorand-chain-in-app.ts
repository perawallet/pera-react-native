/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { ALGORAND_ONLY_FEATURES } from '../shared/algorand-only-features.js'
import { TEST_SUPPORT, withoutTests } from '../shared/scope.js'

export default defineRule({
    id: 'pera/no-algorand-chain-in-app',
    severity: 'error',
    card: {
        message:
            'An app file must not name the Algorand chain unless it is listed as an Algorand-only feature',
        remediation:
            "An account holds a set of chains, so the chain belongs to the operation, never the account: take it from the sign request (`chainIdOfSignRequest`), a `ChainScope` route param, the transaction row, the asset's own chain, or the chain the account holds that serves the capability (`useAccountCapabilityScope`). An account's first chain (`useAccountScope`, `accountChainIdOf`) is a display default only. Wallet-wide values with no caller read `useHomeChainScope()`. UI only one chain serves belongs in that chain's module under `modules/<chain>/`, reached through `chainUiFor(family)`. A feature that exists only on Algorand imports `ALGORAND_CHAIN_ID` from `@modules/algorand/chain-id` and is listed, with a reason, in `lanekeep/shared/algorand-only-features.ts`. Shared hooks and components (`src/hooks/**`, `src/components/**`) are never listed.",
        examples: {
            bad: 'const scope = useSelectedScope(ALGORAND_CHAIN_ID)',
            good: "const scope = useAccountCapabilityScope(account, 'send')",
        },
    },
    gates: withoutTests({
        pathMatches: ['**/apps/mobile/src/**'],
        pathNotMatches: [
            '**/apps/mobile/src/bootstrap/**',
            '**/apps/mobile/src/modules/algorand/**',
            ...TEST_SUPPORT,
            // Shared code is never exempt, even if someone lists it.
            ...ALGORAND_ONLY_FEATURES.filter(
                feature =>
                    !feature.file.startsWith('apps/mobile/src/components/') &&
                    !feature.file.startsWith('apps/mobile/src/hooks/'),
            ).map(feature => `**/${feature.file}`),
        ],
    }),
    // An identifier only, so the name inside a string or a comment stays legal.
    query: `
        ((identifier) @constant
         (#eq? @constant "ALGORAND_CHAIN_ID"))
    `,
    check(ctx, m) {
        if (m.constant !== undefined) {
            ctx.report(
                m.constant,
                'ALGORAND_CHAIN_ID names Algorand in an app file that is not an Algorand-only feature',
            )
        }
    },
})
