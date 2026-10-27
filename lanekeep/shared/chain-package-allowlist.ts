/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

interface ExemptPath {
    glob: string
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
const ETHEREUM = '@perawallet/wallet-core-chain-ethereum'

export const COMPOSITION_ROOTS: ExemptPath[] = [
    {
        glob: '**/apps/mobile/src/bootstrap/chain-adapters.ts',
        reason: 'mobile composition root: registers each chain and its per-package adapters',
    },
    {
        glob: '**/apps/mobile/src/bootstrap/evm-chain-modules.ts',
        reason: 'build-gated EVM chain modules for the mobile composition root; metro.config.js stubs them out of builds whose CHAINS lists no EVM chain',
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
    {
        path: 'apps/mobile/src/modules/ethereum/',
        pkg: ETHEREUM,
        reason: "Ethereum's review and detail UI: renders TransactionNative's evm member with chain-ethereum's EthereumTransactionView; metro stubs its chain-ui entry out of builds whose CHAINS omits ethereum",
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
        glob: '**/apps/benchmarks/**',
        reason: "benchmark app: times the chain packages' own code directly, and is bundled only into a BENCH=1 build",
    },
    {
        glob: '**/conformance/src/**',
        reason: 'conformance harness: runs the real chain code against LocalNet, never bundled',
    },
    {
        glob: '**/conformance-evm/src/**',
        reason: 'EVM conformance harness: runs the real chain code against Anvil, never bundled',
    },
]
