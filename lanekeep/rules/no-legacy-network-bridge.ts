/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { TEST_SUPPORT, withoutTests } from '../shared/scope.js'

// The converters are deleted; a reintroduced name still reports. A package
// that pins the legacy chain breaks the moment it is handed another chain's scope.
const BRIDGE_CALLS = ['legacyNetworkOf', 'scopeForLegacyNetwork', 'useNetwork']

export default defineRule({
    id: 'pera/no-legacy-network-bridge',
    // The files that still bridge are pinned by the spec's baseline, which may
    // only shrink; flip to `error` when it is empty.
    severity: 'warn',
    card: {
        message:
            'A package must not pin the legacy chain or convert a ChainScope to a four-value network',
        remediation:
            "Take the `ChainScope` from the caller and pass `{ scope }` down; only an app pins the Algorand scope with `useSelectedScope(LEGACY_CHAIN_ID)`. A chain-agnostic Pera endpoint (banners, inbox, currencies, integrity) takes no scope: route it by `useWalletDeployment()` and pass `deployment`. Code that is Algorand's own belongs in chain-algorand, which is exempt.",
        examples: {
            bad: 'const scope = useSelectedScope(LEGACY_CHAIN_ID)\nconst network = legacyNetworkOf(scope)',
            good: 'export const useNfdSearchQuery = (scope: ChainScope, name: string) =>\n    useQuery({ queryFn: () => fetchNfdSearch({ name, scope }) })',
        },
    },
    gates: withoutTests({
        pathMatches: ['**/packages/*/src/**'],
        pathNotMatches: [
            '**/packages/chain-algorand/**',
            '**/packages/chain-contract/**',
            '**/packages/chain-shared/src/store/legacy-network.ts',
            ...TEST_SUPPORT,
        ],
    }),
    // Calls only for the converters, so `a.legacyNetworkOf(x)`, a string or a
    // comment stays legal; the constant is reported wherever it is named.
    query: `
        ((call_expression function: (identifier) @fn) @call
         (#any-of? @fn ${BRIDGE_CALLS.map(name => `"${name}"`).join(' ')}))
        ((identifier) @constant
         (#eq? @constant "LEGACY_CHAIN_ID"))
    `,
    check(ctx, m) {
        if (m.call !== undefined && m.fn !== undefined) {
            ctx.report(
                m.fn,
                `${ctx.text(m.fn)}() converts a scope to the legacy Network`,
            )
            return
        }
        if (m.constant !== undefined) {
            ctx.report(
                m.constant,
                'LEGACY_CHAIN_ID pins the Algorand scope outside an app',
            )
        }
    },
})
