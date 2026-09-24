/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { COPYRIGHT_HEADER } from '../shared/copyright.js'

const isLicenceComment = (text: string): boolean =>
    /copyright|license/i.test(text)

export default defineRule({
    id: 'pera/copyright-header',
    severity: 'error',
    card: {
        message: 'source file does not open with the Apache licence header',
        remediation:
            'Run `pnpm lint:fix`, which writes the header. The text lives in lanekeep/shared/copyright.ts: to change it (the year, say), edit it there and run the fix, which rewrites every stale header.',
        examples: {
            bad: "import { x } from './x'",
            good: "/*\n Copyright 2022-2026 Pera Wallet, LDA\n …\n */\n\nimport { x } from './x'",
        },
    },
    gates: {
        pathMatches: [
            '**/apps/*/src/**',
            '**/packages/*/src/**',
            '**/conformance/src/**',
        ],
    },
    query: '(program) @file',
    check(ctx, m) {
        const file = m.file
        if (file === undefined) return
        if (ctx.fileText.startsWith(COPYRIGHT_HEADER)) return

        const [first] = ctx.namedChildren(file)
        if (first === undefined) {
            ctx.report(file, {
                message: 'licence header is missing',
                fix: { node: file, text: `${COPYRIGHT_HEADER}\n`, safe: true },
            })
            return
        }

        // A licence comment already in first position is replaced; anything
        // else (code, a module banner) keeps its place below a new header.
        const firstText = ctx.text(first) ?? ''
        const isStale =
            ctx.kind(first) === 'comment' &&
            firstText.startsWith('/*') &&
            ctx.fileText.startsWith(firstText) &&
            isLicenceComment(firstText)

        ctx.report(first, {
            message: isStale
                ? 'licence header is out of date'
                : 'licence header is missing',
            fix: {
                node: first,
                text: isStale
                    ? COPYRIGHT_HEADER
                    : `${COPYRIGHT_HEADER}\n\n${firstText}`,
                safe: true,
            },
        })
    },
})
