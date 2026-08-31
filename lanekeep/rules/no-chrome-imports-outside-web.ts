/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

// These packages touch the ambient `chrome` global in their module bodies.
// Importing one for its VALUE pulls that code into the importer's bundle.
const CHROME_ONLY = [
    '@perawallet/wallet-extension-platform-chrome',
    '@perawallet/wallet-extension-keystore-chrome',
]

export default defineRule({
    id: 'pera/no-chrome-imports-outside-web',
    severity: 'error',
    card: {
        message: 'chrome-only package imported into a native bundle',
        remediation:
            'Import from the platform-agnostic package that owns the symbol, move the file to apps/browser/src, or rename it `.web.tsx` — importers then need the explicit `.web` specifier. There is deliberately no allowlist.',
        examples: {
            bad: "import { getPlatform } from '@perawallet/wallet-extension-platform-chrome'",
            good: "import { getProvider } from '@perawallet/wallet-extension-platform'",
        },
    },
    gates: {
        fileContains: ['-chrome'],
        // apps/browser is web-only by construction, so chrome exists there.
        // extensions/** holds the chrome packages themselves; without this the
        // byte gate above would make them self-flag. .web.ts(x) resolves only
        // for web builds. Everything else — packages/* included — is bundled
        // into the native app just as directly as apps/mobile/src, so it stays
        // in scope.
        pathNotMatches: [
            'apps/browser/**',
            'extensions/**',
            '**/*.web.ts',
            '**/*.web.tsx',
        ],
    },
    query: '(import_statement (string (string_fragment) @src) @str) @stmt',
    check(ctx, m) {
        const src = m.src
        const str = m.str
        const stmt = m.stmt
        if (src === undefined || str === undefined || stmt === undefined) return

        const specifier = ctx.text(src)
        if (specifier === undefined) return
        const isChrome = CHROME_ONLY.some(
            pkg => specifier === pkg || specifier.startsWith(`${pkg}/`),
        )
        if (!isChrome) return

        // A type-only import emits nothing, so it cannot drag chrome code into
        // the bundle. Safe only when EVERY binding is type-only.
        const parts = ctx.children(stmt)
        if (parts.some(p => ctx.kind(p) === 'type')) return
        const specs = ctx.querySubtree(stmt, '(import_specifier) @s')
        if (
            specs.length > 0 &&
            specs.every(
                s =>
                    s.s !== undefined &&
                    ctx.children(s.s).some(p => ctx.kind(p) === 'type'),
            )
        ) {
            return
        }

        ctx.report(
            str,
            `${specifier} is chrome-only and must not be imported here`,
        )
    },
})
