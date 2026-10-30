/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    SHARED_APP_CODE_PATHS,
    TEST_SUPPORT,
    withoutTests,
} from '../shared/scope.js'

export default defineRule({
    id: 'pera/no-legacy-chain-in-app',
    // The files that still pin the legacy chain are listed by the spec's
    // baseline, which may only shrink; flip to `error` when it is empty.
    severity: 'warn',
    card: {
        message:
            'A shared app module must not pin the Algorand scope with LEGACY_CHAIN_ID',
        remediation:
            "Take the chain from where the user entered the feature: the account's scope (`useAccountScope`), the sign request (`chainIdOfSignRequest`), or a `ChainScope` route param. UI only one chain serves belongs in that chain's module under `modules/<chain>/`, reached through `chainUiFor(family)`. Only `bootstrap/` and `modules/algorand/` may name the legacy chain; the shared hooks and components answer to `pera/no-legacy-chain-in-shared-app-code`, which blocks on them.",
        examples: {
            bad: 'const scope = useSelectedScope(LEGACY_CHAIN_ID)',
            good: 'const scope = useAccountScope(account)',
        },
    },
    gates: withoutTests({
        pathMatches: ['**/apps/mobile/src/**'],
        pathNotMatches: [
            '**/apps/mobile/src/bootstrap/**',
            '**/apps/mobile/src/modules/algorand/**',
            // The shared hooks and components have their own rule, which
            // blocks on them: pera/no-legacy-chain-in-shared-app-code.
            ...SHARED_APP_CODE_PATHS,
            ...TEST_SUPPORT,
        ],
    }),
    // An identifier only, so the name inside a string or a comment stays legal.
    query: `
        ((identifier) @constant
         (#eq? @constant "LEGACY_CHAIN_ID"))
    `,
    check(ctx, m) {
        if (m.constant !== undefined) {
            ctx.report(
                m.constant,
                'LEGACY_CHAIN_ID pins the Algorand scope in a shared app module',
            )
        }
    },
})
