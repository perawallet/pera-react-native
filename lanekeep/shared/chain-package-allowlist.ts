/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

interface ExemptPath {
    glob: string
    reason: string
}

interface TransitionalEntry {
    // Repo-relative; a trailing slash makes it a directory.
    path: string
    // The only chain-package specifiers the entry may import.
    specifiers: string[]
    reason: string
}

interface ChainUiModule {
    // Repo-relative directory, with a trailing slash.
    path: string
    // The one chain package the module may import, at any subpath.
    pkg: string
    reason: string
}

const ALGORAND = '@perawallet/wallet-core-chain-algorand'

export const COMPOSITION_ROOTS: ExemptPath[] = [
    {
        glob: '**/apps/mobile/src/bootstrap/chain-adapters.ts',
        reason: 'mobile composition root: registers each chain and its per-package adapters',
    },
    {
        glob: '**/apps/mobile/src/bootstrap/ethereum-chain-module.ts',
        reason: 'build-gated Ethereum module for the mobile composition root; metro.config.js stubs it out of builds whose CHAINS omits ethereum',
    },
    {
        glob: '**/apps/mobile/src/bootstrap/keystore-maintenance.ts',
        reason: "mobile composition root: hands Algorand's post-quantum keygen seed derivation to keystore maintenance",
    },
    {
        glob: '**/apps/browser/src/offscreen/runOffscreenApp.ts',
        reason: "extension offscreen composition root: passes the Algorand chain id and the custom node's genesis hash to the dApp handler",
    },
    {
        glob: '**/apps/browser/src/background/index.ts',
        reason: "extension service-worker composition root: hands the Algorand descriptor's URI schemes to the push handlers",
    },
]

// A chain's own UI: the app's only code that reads that chain's transaction and
// account shapes, so the rest of the app stays chain-neutral.
export const CHAIN_UI_MODULES: ChainUiModule[] = [
    {
        path: 'apps/mobile/src/modules/algorand/',
        pkg: ALGORAND,
        reason: "Algorand's review and detail UI: renders TransactionNative's algorand member with chain-algorand's view types and classifiers",
    },
]

// Test support not named as a test; `withoutTests()` already drops `__tests__/` and `*.spec.*`.
export const TEST_PATHS: ExemptPath[] = [
    {
        glob: '**/test-utils/**',
        reason: 'test harness: builds real chain adapters and mocks for specs, never bundled',
    },
    {
        glob: '**/__integration__/**',
        reason: 'integration harness: registers the real chain for flow tests, never bundled',
    },
    {
        glob: '**/conformance/src/**',
        reason: 'conformance harness: runs the real chain code against LocalNet, never bundled',
    },
]

// Only whole-move shims live here. A package split behind an adapter has no
// shim and gets no entry.
export const TRANSITIONAL_ALLOWLIST: TransitionalEntry[] = [
    {
        path: 'packages/asa-inbox/src/index.ts',
        specifiers: [`${ALGORAND}/asa-inbox`],
        reason: 'one-line re-export shim for the asa-inbox whole move (PERA-5226) until its importers switch',
    },
    {
        path: 'packages/fee-delegation/src/index.ts',
        specifiers: [`${ALGORAND}/fee-delegation`],
        reason: 'one-line re-export shim for the fee-delegation whole move (PERA-5233) until its importers switch',
    },
]
