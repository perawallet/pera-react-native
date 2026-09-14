/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

const PROTOCOLS = ['v1', 'v2'] as const
type Protocol = (typeof PROTOCOLS)[number]

/** Which protocol directory a linted file lives under, if any. */
const ownProtocol = (filePath: string): Protocol | undefined =>
    PROTOCOLS.find(p => filePath.includes(`/${p}/`))

const otherProtocol = (protocol: Protocol): Protocol =>
    protocol === 'v1' ? 'v2' : 'v1'

/** Whether an import specifier reaches into the given protocol's directory. */
const reachesInto = (specifier: string, protocol: Protocol): boolean =>
    specifier.includes(`/${protocol}/`) || specifier.startsWith(`${protocol}/`)

export default defineRule({
    id: 'pera/no-cross-protocol-imports',
    severity: 'error',
    card: {
        message: 'WalletConnect v1 and v2 must not import each other',
        remediation:
            'Move the shared symbol into packages/walletconnect/src/shared and import it from there. v1 and v2 are independent protocol implementations that happen to share a package; separate packages would have made this impossible via pnpm, so the rule enforces it instead. Type-only imports count — the boundary is about decoupling, not bundle size.',
        examples: {
            bad: "// in src/v2/handler.ts\nimport { connectorRegistry } from '../v1/connectorRegistry'",
            good: "// in src/v2/handler.ts\nimport { PERA_CLIENT_META } from '../shared'",
        },
    },
    gates: {
        pathMatches: ['**/v1/**', '**/v2/**'],
    },
    query: '(import_statement (string (string_fragment) @src) @str)',
    check(ctx, m) {
        const src = m.src
        const str = m.str
        if (src === undefined || str === undefined) return

        const own = ownProtocol(ctx.filePath)
        if (own === undefined) return
        const foreign = otherProtocol(own)

        const specifier = ctx.text(src)
        if (specifier === undefined) return
        if (!reachesInto(specifier, foreign)) return

        // Unlike no-chrome-imports-outside-web, this boundary is about
        // decoupling rather than bundle size, so type-only imports are
        // flagged too — a type dependency still couples v1 and v2.
        ctx.report(
            str,
            `${specifier} reaches into ${foreign}/ — v1 and v2 must not import each other`,
        )
    },
})
