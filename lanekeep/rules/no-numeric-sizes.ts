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
    JSX_NUMERIC_SIZE_PROP_QUERY,
    SIZE_CONSTANT_NAME,
    SIZE_CONSTANT_QUERY,
    TOKEN_ARITHMETIC_QUERY,
    TYPOGRAPHY_CONSTANT_NAME,
    constantSinks,
    isOutermostTokenArithmetic,
    numericLiteral,
} from '../shared/size-literals.js'

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

const TS_QUERY = [
    MAKE_STYLES_QUERY,
    TOKEN_ARITHMETIC_QUERY,
    SIZE_CONSTANT_QUERY,
].join('\n')
const TSX_QUERY = [TS_QUERY, JSX_NUMERIC_SIZE_PROP_QUERY].join('\n')

export default defineRule({
    id: 'pera/no-numeric-sizes',
    severity: 'error',
    card: {
        message:
            'literal numeric size, theme-token arithmetic, or a size constant feeding styles',
        remediation:
            "Use one theme token at the use site: theme.spacing.*, theme.borderRadius.* or theme.borders.* from apps/mobile/src/theme/theme.ts (a circle's radius is theme.borderRadius.full). A deliberate derivation or a bespoke artwork size keeps its value under a suppression comment for this rule whose reason states the derivation or what the value is.",
        examples: {
            bad: 'borderRadius: theme.spacing.xl / 2',
            good: 'borderRadius: theme.borderRadius.full',
        },
    },
    gates: productionSource(),
    query: { typescript: TS_QUERY, tsx: TSX_QUERY },
    check(ctx, m) {
        if (m.call !== undefined && m.fn !== undefined) {
            checkMakeStyles(ctx, m.call, m.fn)
        } else if (m.arith !== undefined) {
            if (!isOutermostTokenArithmetic(ctx, m.arith)) return
            const text = ctx.text(m.arith)?.replace(/\s+/g, ' ')
            ctx.report(
                m.arith,
                `theme-token arithmetic "${text}" — use one theme token`,
            )
        } else if (m.jsxProp !== undefined && m.jsxValue !== undefined) {
            const literal = numericLiteral(ctx, m.jsxValue)
            if (literal === undefined || literal === '0') return
            ctx.report(
                m.jsxValue,
                `numeric value ${literal} for JSX prop "${ctx.text(m.jsxProp)}" — use a theme token`,
            )
        } else if (m.constName !== undefined && m.constValue !== undefined) {
            const name = ctx.text(m.constName)
            if (name === undefined || !SIZE_CONSTANT_NAME.test(name)) return
            // The typography rule owns these; reporting here too would double up.
            if (TYPOGRAPHY_CONSTANT_NAME.test(name)) return
            const literal = numericLiteral(ctx, m.constValue)
            if (literal === undefined) return
            const sinks = constantSinks(ctx, m.constName)
            if (!sinks.has('makeStyles') && !sinks.has('jsxSizeProp')) return
            ctx.report(
                m.constName,
                `module constant ${name} = ${literal} feeds styles — use a theme token at the use site`,
            )
        }
    },
})

function checkMakeStyles(ctx: RuleContext, call: Node, fn: Node): void {
    if (!isRneuiMakeStyles(ctx, fn)) return

    for (const entry of styleEntries(ctx, call)) {
        for (const pair of ctx.namedChildren(entry.value)) {
            if (ctx.kind(pair) !== 'pair') continue
            const [key, value] = ctx.namedChildren(pair)
            if (key === undefined || value === undefined) continue
            const name = ctx.text(key)
            if (name === undefined || !SPACING_PROPS.has(name)) continue

            const literal = numericLiteral(ctx, value)
            // `0` is the one value with no meaningful token equivalent.
            if (literal === undefined || literal === '0') continue

            ctx.report(
                value,
                `numeric value ${literal} for "${name}" — use a theme token`,
            )
        }
    }
}
