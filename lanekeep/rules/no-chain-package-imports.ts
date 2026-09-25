/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

type AllowlistEntry = { glob: string; reason: string }

// An explicit list, not a `wallet-core-chain-*` prefix: chain-contract and
// chain-shared are chain-agnostic, every package imports them, and they must
// never be listed here. `dir` exempts the chain package's own sources.
const CHAIN_PACKAGES: { specifier: string; dir: string }[] = [
    {
        specifier: '@perawallet/wallet-core-chain-algorand',
        dir: 'packages/chain-algorand',
    },
]

const COMPOSITION_ROOTS: AllowlistEntry[] = [
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

// Re-export shims and app subpath importers that exist only while Algorand code
// moves into its chain package; each entry leaves once its importers are gone.
const TRANSITIONAL_ALLOWLIST: AllowlistEntry[] = []

export default defineRule({
    id: 'pera/no-chain-package-imports',
    severity: 'error',
    card: {
        message:
            'only a composition root or the chain package itself may import a chain package',
        remediation:
            'Reach the chain through getProvider().chains, or the chain hooks built on it. Types every chain shares belong in @perawallet/wallet-core-chain-contract and state every chain shares in @perawallet/wallet-core-chain-shared; both are free to import. A direct import couples the importer to one chain, so adding the next chain means special-casing every such file. Type-only imports count. The composition roots and the transitional allowlist are listed, each with a reason, in the rule; a new entry needs one too.',
        examples: {
            bad: "// in packages/accounts/src/hooks/useAccountBalances.ts\nimport { algorandChain } from '@perawallet/wallet-core-chain-algorand'",
            good: '// in packages/accounts/src/hooks/useAccountBalances.ts\nconst chain = getProvider().chains.get(chainId)',
        },
    },
    gates: {
        pathNotMatches: [
            ...COMPOSITION_ROOTS.map(e => e.glob),
            ...TRANSITIONAL_ALLOWLIST.map(e => e.glob),
            ...CHAIN_PACKAGES.map(p => `**/${p.dir}/**`),
        ],
        // `fileContains` is an AND across entries; the shared prefix keeps it
        // one entry however many chain packages are listed.
        fileContains: ['@perawallet/wallet-core-chain-'],
    },
    // Every form that creates the dependency: static, `export … from`, and a
    // deferred `import()`.
    query: `
        (import_statement (string (string_fragment) @src) @str)
        (export_statement (string (string_fragment) @src) @str)
        (call_expression
          function: (import)
          arguments: (arguments (string (string_fragment) @src) @str))
    `,
    check(ctx, m) {
        const src = m.src
        const str = m.str
        if (src === undefined || str === undefined) return

        const specifier = ctx.text(src)
        if (specifier === undefined) return
        const isChainPackage = CHAIN_PACKAGES.some(
            ({ specifier: pkg }) =>
                specifier === pkg || specifier.startsWith(`${pkg}/`),
        )
        if (!isChainPackage) return

        ctx.report(
            str,
            `${specifier} is a chain package — reach it through getProvider().chains instead`,
        )
    },
})
