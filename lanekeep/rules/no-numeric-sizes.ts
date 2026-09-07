/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    MAKE_STYLES_QUERY,
    isRneuiMakeStyles,
    styleEntries,
} from '../shared/make-styles.js'

const SPACING_PROPS = new Set([
    'padding',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'paddingHorizontal',
    'paddingVertical',
    'margin',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'marginHorizontal',
    'marginVertical',
    'top',
    'right',
    'bottom',
    'left',
    'width',
    'height',
    'minWidth',
    'maxWidth',
    'minHeight',
    'maxHeight',
    'borderRadius',
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomLeftRadius',
    'borderBottomRightRadius',
    'borderWidth',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'gap',
    'rowGap',
    'columnGap',
])

export default defineRule({
    id: 'pera/no-numeric-sizes',
    severity: 'error',
    card: {
        message: 'literal numeric spacing or sizing value',
        remediation:
            'Use theme.spacing.*, theme.borderRadius.*, or theme.borders.* from apps/mobile/src/theme/theme.ts.',
        examples: {
            bad: 'container: { padding: 16 }',
            good: 'container: { padding: theme.spacing.md }',
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
                const [key, value] = ctx.namedChildren(pair)
                if (key === undefined || value === undefined) continue
                const name = ctx.text(key)
                if (name === undefined || !SPACING_PROPS.has(name)) continue

                const kind = ctx.kind(value)
                let literal: string | undefined
                if (kind === 'number') {
                    literal = ctx.text(value)
                } else if (kind === 'unary_expression') {
                    // `-8` parses as a unary minus over a number.
                    const raw = ctx.text(value)
                    if (raw !== undefined && /^-\s*\d/.test(raw)) literal = raw
                }
                // `0` is the one value with no meaningful token equivalent.
                if (literal === undefined || literal === '0') continue

                ctx.report(
                    value,
                    `numeric value ${literal} for "${name}" — use a theme token`,
                )
            }
        }
    },
})
