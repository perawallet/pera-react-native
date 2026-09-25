/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

// The mobile and browser vitest configs collect only `*.spec.*`, so a
// `.test.*` file there never runs; one suffix everywhere keeps that simple.
const TEST_SUFFIX = /\.test\.[cm]?[jt]sx?$/

export default defineRule({
    id: 'pera/spec-file-suffix',
    language: ['typescript', 'tsx', 'javascript'],
    severity: 'error',
    card: {
        message: 'a test file uses the .test suffix',
        remediation:
            'Rename it to .spec.ts or .spec.tsx: the vitest configs collect only *.spec.*, so this file never runs.',
        examples: {
            bad: 'useWallet.test.ts',
            good: 'useWallet.spec.ts',
        },
    },
    gates: { pathMatches: ['**/*.test.{ts,tsx,js,jsx,mjs,cjs}'] },
    // A tree-sitter misparse can make the root ERROR rather than program.
    query: '[(program) (ERROR)] @file',
    check(ctx, m) {
        const file = m.file
        if (file === undefined || ctx.parent(file) !== undefined) return
        if (!TEST_SUFFIX.test(ctx.filePath)) return
        ctx.report(
            file,
            `${ctx.filePath.split('/').pop()} never runs under vitest; rename it to .spec`,
        )
    },
})
