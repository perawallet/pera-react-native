/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    MAKE_STYLES_QUERY,
    isRneuiMakeStyles,
    styleEntries,
} from '../shared/make-styles.js'

const TYPOGRAPHY_PROPS = new Set([
    'fontSize',
    'fontFamily',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
])

export default defineRule({
    id: 'pera/no-typography-in-styles',
    severity: 'error',
    card: {
        message: 'typography property set directly inside makeStyles',
        remediation:
            'Use getTypography(theme, variant) from @/theme/typography (h1..h4, body, caption, link, mono), or a PWText variant prop from @components/core.',
        examples: {
            bad: 'title: { fontSize: 14 }',
            good: "title: { ...getTypography(theme, 'h2') }",
        },
    },
    gates: { fileContains: ['makeStyles'] },
    query: MAKE_STYLES_QUERY,
    check(ctx, m) {
        const call = m.call
        const fn = m.fn
        if (call === undefined || fn === undefined) return
        if (!isRneuiMakeStyles(ctx, fn)) return

        for (const entry of styleEntries(ctx, call)) {
            for (const pair of ctx.namedChildren(entry.value)) {
                if (ctx.kind(pair) !== 'pair') continue
                const [key] = ctx.namedChildren(pair)
                if (key === undefined) continue
                const name = ctx.text(key)
                if (name === undefined || !TYPOGRAPHY_PROPS.has(name)) continue
                ctx.report(
                    pair,
                    `typography property "${name}" is not allowed inside makeStyles`,
                )
            }
        }
    },
})
