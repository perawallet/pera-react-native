/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, RuleContext } from 'lanekeep'
import {
    MAKE_STYLES_QUERY,
    isRneuiMakeStyles,
    styleEntries,
} from '../shared/make-styles.js'
import { productionSource } from '../shared/scope.js'
import {
    SIZE_CONSTANT_QUERY,
    TYPOGRAPHY_CONSTANT_NAME,
    constantSinks,
    numericLiteral,
} from '../shared/size-literals.js'

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
        message:
            'typography property set directly inside makeStyles, or a font-size/line-height constant',
        remediation:
            'Use getTypography(theme, variant) from @/theme/typography (h1..h4, body, caption, link, mono), or a PWText variant prop from @components/core. No font-size or line-height constants; snap to the nearest variant.',
        examples: {
            bad: 'title: { fontSize: 14 }',
            good: "title: { ...getTypography(theme, 'h2') }",
        },
    },
    gates: productionSource(),
    query: [MAKE_STYLES_QUERY, SIZE_CONSTANT_QUERY].join('\n'),
    check(ctx, m) {
        if (m.call !== undefined && m.fn !== undefined) {
            checkMakeStyles(ctx, m.call, m.fn)
        } else if (m.constName !== undefined && m.constValue !== undefined) {
            const name = ctx.text(m.constName)
            if (name === undefined || !TYPOGRAPHY_CONSTANT_NAME.test(name)) {
                return
            }
            const literal = numericLiteral(ctx, m.constValue)
            if (literal === undefined) return
            const sinks = constantSinks(ctx, m.constName)
            if (!sinks.has('makeStyles') && !sinks.has('typography')) return
            ctx.report(
                m.constName,
                `module constant ${name} = ${literal} sets typography — use getTypography or a PWText variant`,
            )
        }
    },
})

function checkMakeStyles(ctx: RuleContext, call: Node, fn: Node): void {
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
}
