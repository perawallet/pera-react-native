/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    COMPOSITION_ROOTS,
    TEST_PATHS,
    TRANSITIONAL_ALLOWLIST,
} from '../shared/chain-package-allowlist.js'

const CHAIN_PACKAGE_PREFIX = '@perawallet/wallet-core-chain-'

// Every package every chain shares; everything else under the prefix is a chain
// package, so a new chain is covered without editing this rule.
const CHAIN_AGNOSTIC_PACKAGES = new Set([
    '@perawallet/wallet-core-chain-contract',
    '@perawallet/wallet-core-chain-shared',
])

const packageNameOf = (specifier: string): string => {
    const [scope, name] = specifier.split('/')
    return `${scope}/${name}`
}

const dirOf = (pkg: string): string =>
    `/packages/${pkg.slice('@perawallet/wallet-core-'.length)}/`

const matchesPath = (filePath: string, path: string): boolean =>
    path.endsWith('/')
        ? filePath.includes(`/${path}`)
        : filePath.endsWith(`/${path}`)

export default defineRule({
    id: 'pera/no-chain-package-imports',
    severity: 'error',
    card: {
        message:
            'only a composition root or the chain package itself may import a chain package',
        remediation:
            'Reach the chain through getProvider().chains, or the chain hooks built on it. Types every chain shares belong in @perawallet/wallet-core-chain-contract and state every chain shares in @perawallet/wallet-core-chain-shared; both are free to import. A direct import couples the importer to one chain, so adding the next chain means special-casing every such file. Type-only imports count, and a chain package may not import another chain package. The composition roots, test paths and the transitional allowlist of whole-move shims are listed, each with a reason, in the rule; a new entry needs one too.',
        examples: {
            bad: "// in packages/accounts/src/hooks/useAccountBalances.ts\nimport { algorandChain } from '@perawallet/wallet-core-chain-algorand'",
            good: '// in packages/accounts/src/hooks/useAccountBalances.ts\nconst chain = getProvider().chains.get(chainId)',
        },
    },
    gates: {
        pathNotMatches: [
            ...COMPOSITION_ROOTS.map(e => e.glob),
            ...TEST_PATHS.map(e => e.glob),
        ],
        fileContains: [CHAIN_PACKAGE_PREFIX],
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
        if (specifier?.startsWith(CHAIN_PACKAGE_PREFIX) !== true) return
        const pkg = packageNameOf(specifier)
        if (CHAIN_AGNOSTIC_PACKAGES.has(pkg)) return

        // Leading slash so a repo-relative path still matches on a directory boundary.
        const filePath = `/${ctx.filePath}`
        if (filePath.includes(dirOf(pkg))) return
        const isAllowListed = TRANSITIONAL_ALLOWLIST.some(
            entry =>
                matchesPath(filePath, entry.path) &&
                entry.specifiers.includes(specifier),
        )
        if (isAllowListed) return

        ctx.report(
            str,
            `${specifier} is a chain package — reach it through getProvider().chains instead`,
        )
    },
})
