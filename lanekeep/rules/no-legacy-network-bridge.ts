/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { COMPOSITION_ROOTS } from '../shared/chain-package-allowlist.js'
import { TEST_SUPPORT, withoutTests } from '../shared/scope.js'

// The converters are deleted; a reintroduced name still reports. A package
// that pins the legacy chain breaks the moment it is handed another chain's
// scope, and an app that reads the deployment off the store breaks the moment
// the store grows a second deployment.
const BRIDGE_CALLS = [
    'legacyNetworkOf',
    'scopeForLegacyNetwork',
    'useNetwork',
    'useDeviceID',
]

// App code, as opposed to the packages. The composition roots are the ones
// that may read the store itself: they wire it.
const APP_SOURCE = /(^|\/)apps\/[^/]+\/src\//

export default defineRule({
    id: 'pera/no-legacy-network-bridge',
    // The files that still bridge are pinned by the spec's baseline, which may
    // only shrink; flip to `error` when it is empty.
    severity: 'warn',
    card: {
        message:
            'A package must not pin the legacy chain or convert a ChainScope to a four-value network, and app code must not read the deployment off the network store',
        remediation:
            "Take the `ChainScope` from the caller and pass `{ scope }` down; only an app pins the Algorand scope with `useSelectedScope(LEGACY_CHAIN_ID)`. A chain-agnostic Pera endpoint (banners, inbox, currencies, integrity) takes no scope: route it by `useWalletDeployment()` and pass `deployment`. Code that is Algorand's own belongs in chain-algorand, which is exempt. In app code the deployment is read with `useWalletDeployment()`, never with `useNetworkStore(state => state.mode)`.",
        examples: {
            bad: 'const scope = useSelectedScope(LEGACY_CHAIN_ID)\nconst network = legacyNetworkOf(scope)',
            good: 'export const useNfdSearchQuery = (scope: ChainScope, name: string) =>\n    useQuery({ queryFn: () => fetchNfdSearch({ name, scope }) })',
        },
    },
    gates: withoutTests({
        pathMatches: ['**/packages/*/src/**', '**/apps/*/src/**'],
        pathNotMatches: [
            '**/packages/chain-algorand/**',
            '**/packages/chain-contract/**',
            '**/packages/chain-shared/src/store/legacy-network.ts',
            // The composition roots wire the store, so they may read it.
            '**/apps/mobile/src/bootstrap/**',
            ...COMPOSITION_ROOTS.map(root => root.glob),
            ...TEST_SUPPORT,
        ],
    }),
    // Calls only for the converters, so `a.legacyNetworkOf(x)`, a string or a
    // comment stays legal; the constant is reported wherever it is named.
    // The deployment read is a call with a selector, so `useNetworkStore` on
    // its own is legal and only the `mode` selector is caught.
    query: `
        ((call_expression function: (identifier) @fn) @call
         (#any-of? @fn ${BRIDGE_CALLS.map(name => `"${name}"`).join(' ')}))
        ((call_expression
           function: (identifier) @store
           arguments: (arguments (arrow_function body: (member_expression property: (property_identifier) @prop))))
         (#eq? @store "useNetworkStore")
         (#eq? @prop "mode"))
        ((identifier) @constant
         (#eq? @constant "LEGACY_CHAIN_ID"))
    `,
    check(ctx, m) {
        const isApp = APP_SOURCE.test(ctx.filePath)

        if (m.store !== undefined && m.prop !== undefined) {
            // Only app code is told to ask `useWalletDeployment()`: in the
            // packages the mode selector IS that hook.
            if (!isApp) return
            ctx.report(
                m.store,
                'useNetworkStore(state => state.mode) reads the deployment off the store; use useWalletDeployment()',
            )
            return
        }
        if (m.call !== undefined && m.fn !== undefined) {
            ctx.report(
                m.fn,
                `${ctx.text(m.fn)}() converts a scope to the legacy Network`,
            )
            return
        }
        if (m.constant !== undefined) {
            // In app code the legacy chain belongs to the chain rules:
            // pera/no-legacy-chain-in-app and
            // pera/no-legacy-chain-in-shared-app-code.
            if (isApp) return
            ctx.report(
                m.constant,
                'LEGACY_CHAIN_ID pins the Algorand scope outside an app',
            )
        }
    },
})
