/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    SHARED_APP_CODE_PATHS,
    TEST_SUPPORT,
    withoutTests,
} from '../shared/scope.js'

// The shared hooks and components: code every chain's UI reuses. A chain
// pinned here is right for one chain and wrong for every other, so a shared
// refresh hook stops serving the chain its caller did not ask for.
//
// This rule is separate from `pera/no-legacy-chain-in-app` because lanekeep's
// severity is per rule, not per path: the rest of the app's legacy-chain
// debt is still a warning, while the shared code is blocking.
export default defineRule({
    id: 'pera/no-legacy-chain-in-shared-app-code',
    // The spec's baseline is empty: every shared hook and component is clean,
    // so the rule blocks on the next one that pins the legacy chain.
    severity: 'error',
    card: {
        message:
            'A shared hook or component must not pin the Algorand scope with LEGACY_CHAIN_ID',
        remediation:
            "Take the chain from where the user entered the feature: the account's scope (`useAccountScope`), the sign request (`chainIdOfSignRequest`), or a `ChainScope` route param. A shared hook takes its scope from its caller; a shared component takes a `chainId` prop. UI only one chain serves belongs in that chain's module under `modules/<chain>/`, reached through `chainUiFor(family)`.",
        examples: {
            bad: 'const scope = useSelectedScope(LEGACY_CHAIN_ID)',
            good: 'const scope = useAccountScope(account)',
        },
    },
    gates: withoutTests({
        pathMatches: [...SHARED_APP_CODE_PATHS],
        pathNotMatches: [...TEST_SUPPORT],
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
                'LEGACY_CHAIN_ID pins the Algorand scope in shared app code',
            )
        }
    },
})
