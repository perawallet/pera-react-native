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

const ALGORAND = '@perawallet/wallet-core-chain-algorand'

export const COMPOSITION_ROOTS: ExemptPath[] = [
    {
        glob: '**/apps/mobile/src/bootstrap/chain-adapters.ts',
        reason: 'mobile composition root: registers each chain and its per-package adapters',
    },
    {
        glob: '**/apps/mobile/src/useAppBootstrap.ts',
        reason: 'mobile composition root: registers each chain with the platform provider',
    },
    {
        glob: '**/apps/mobile/src/App.web.tsx',
        reason: 'web composition root: registers each chain for the web build the extension renders',
    },
    {
        glob: '**/apps/browser/src/offscreen/runOffscreenApp.ts',
        reason: 'extension offscreen composition root: registers each chain for the offscreen document',
    },
    {
        glob: '**/apps/browser/src/background/index.ts',
        reason: 'extension service-worker composition root: registers each chain for the background context',
    },
]

// `__tests__/` and `*.spec.*` are already outside the lanekeep corpus.
export const TEST_PATHS: ExemptPath[] = [
    {
        glob: '**/test-utils/**',
        reason: 'test harness: builds real chain adapters and mocks for specs, never bundled',
    },
    {
        glob: '**/__integration__/**',
        reason: 'integration harness: registers the real chain for flow tests, never bundled',
    },
]

// Only whole-move shims and the app files that still reach their subpaths live
// here. A package split behind an adapter has no shim and gets no entry.
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
    {
        path: 'packages/blockchain/src/',
        specifiers: [`${ALGORAND}/blockchain`],
        reason: 'runtime re-export for the blockchain whole move (PERA-5229) until its importers switch',
    },
    {
        path: 'apps/mobile/src/',
        specifiers: [`${ALGORAND}/asa-inbox`, `${ALGORAND}/fee-delegation`],
        reason: 'mobile screens still call the whole-moved asa-inbox and fee-delegation APIs until their UI gates on a chain capability',
    },
    {
        path: 'apps/browser/src/',
        specifiers: [`${ALGORAND}/asa-inbox`, `${ALGORAND}/fee-delegation`],
        reason: 'extension screens still call the whole-moved asa-inbox and fee-delegation APIs until their UI gates on a chain capability',
    },
]
