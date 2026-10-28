/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { TEST_FILES, TEST_SUPPORT } from '../shared/scope.js'

export default defineRule({
    id: 'pera/no-workspace-require-in-tests',
    severity: 'error',
    card: {
        message: 'test code require()s a workspace package',
        remediation:
            "Every workspace package is ESM. Under the vmThreads pool on Node 22 (CI's version), `require()` of one fails, while Node 24 loads it, so it passes locally and breaks CI. Use `await vi.importActual(...)` in an async `vi.mock` factory, or a static import.",
        examples: {
            bad: "vi.mock('x', () => ({ registry: require('@perawallet/wallet-extension-hardware-wallet').createHardwareWalletRegistry() }))",
            good: "vi.mock('x', async () => {\n    const { createHardwareWalletRegistry } = await vi.importActual<typeof import('@perawallet/wallet-extension-hardware-wallet')>('@perawallet/wallet-extension-hardware-wallet')\n    return { registry: createHardwareWalletRegistry() }\n})",
        },
    },
    gates: {
        pathMatches: [...TEST_FILES, ...TEST_SUPPORT],
        fileContains: ['require(', '@perawallet/'],
    },
    query: `
        (call_expression
           function: (identifier) @fn
           arguments: (arguments (string (string_fragment) @source))
           (#eq? @fn "require")
           (#match? @source "^@perawallet/")) @call
    `,
    check(ctx, m) {
        const call = m.call
        if (call === undefined) return
        ctx.report(
            call,
            `require('${ctx.text(m.source ?? call)}') fails under vmThreads on Node 22; use \`await vi.importActual\` or a static import`,
        )
    },
})
