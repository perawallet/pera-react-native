/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, RuleContext } from 'lanekeep'
import noRestrictedTypes from 'lanekeep/no-restricted-types'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

// Case-sensitive, `*`-only patterns: an exact lowercase name plus a camelCase
// suffix, so `feedback` and `amountLabel` stay out.
const NAMES = [
    'amount',
    'amounts',
    '*Amount',
    '*Amounts',
    'balance',
    'balances',
    '*Balance',
    '*Balances',
    'price',
    'prices',
    '*Price',
    '*Prices',
    'fee',
    'fees',
    '*Fee',
    '*Fees',
]

const FORBID = ['number', 'string']

const REASON =
    'Amounts, balances, prices and fees are Decimal: a number loses precision past 2^53, and a string does arithmetic by concatenation.'

// The built-in's oracle sees `Nullable<number>` as an opaque named type, so
// `pera/prefer-nullable-alias`'s autofix would launder `fee: number | null`
// out of this rule. These wrappers are unwrapped by syntax before matching.
const NULLISH_ALIASES = new Set(['Nullable', 'Optional', 'Maybe'])

const builtIn = noRestrictedTypes({
    conventions: [{ names: NAMES, forbid: FORBID, reason: REASON }],
})

const NAME_PATTERNS = NAMES.map(
    pattern => new RegExp(`^${pattern.replaceAll('*', '.*')}$`),
)

function annotationOf(
    ctx: RuleContext,
    name: Node,
    captured: Node | undefined,
) {
    if (captured !== undefined) return captured
    const owner = ctx.parent(name)
    if (owner === undefined) return undefined
    return ctx
        .namedChildren(owner)
        .find(child => ctx.kind(child) === 'type_annotation')
}

function aliasArgument(ctx: RuleContext, node: Node): Node | undefined {
    if (ctx.kind(node) !== 'generic_type') return undefined
    const [name, args] = ctx.namedChildren(node)
    if (name === undefined || args === undefined) return undefined
    if (ctx.kind(name) !== 'type_identifier') return undefined
    if (!NULLISH_ALIASES.has(ctx.text(name) ?? '')) return undefined
    const members = ctx.namedChildren(args)
    return members.length === 1 ? members[0] : undefined
}

function hasAlias(ctx: RuleContext, node: Node): boolean {
    if (aliasArgument(ctx, node) !== undefined) return true
    const kind = ctx.kind(node)
    if (
        kind === 'type_annotation' ||
        kind === 'union_type' ||
        kind === 'parenthesized_type'
    ) {
        return ctx.namedChildren(node).some(child => hasAlias(ctx, child))
    }
    return false
}

// The non-union, non-wrapper members a type reduces to once every nullish
// alias and union is flattened.
function leaves(ctx: RuleContext, node: Node): Node[] {
    const inner = aliasArgument(ctx, node)
    if (inner !== undefined) return leaves(ctx, inner)
    const kind = ctx.kind(node)
    if (
        kind === 'type_annotation' ||
        kind === 'union_type' ||
        kind === 'parenthesized_type'
    ) {
        return ctx.namedChildren(node).flatMap(child => leaves(ctx, child))
    }
    return [node]
}

function isForbidden(ctx: RuleContext, leaf: Node): boolean {
    const type = ctx.types.typeOf(leaf)
    if (type?.primitive !== undefined) return FORBID.includes(type.primitive)
    if (type?.union !== undefined) {
        return type.union.some(
            member =>
                member.primitive !== undefined &&
                FORBID.includes(member.primitive),
        )
    }
    return (
        ctx.kind(leaf) === 'predefined_type' &&
        FORBID.includes(ctx.text(leaf) ?? '')
    )
}

export default defineRule({
    ...builtIn,
    id: 'pera/amount-types',
    severity: 'error',
    gates: productionSource({
        pathNotMatches: [
            ...TEST_SUPPORT,
            // Indexer JSON wire shapes (the schema and the raw-transaction subset
            // balance-impacts reads): amounts arrive as number, string or bigint.
            'packages/chain-algorand/src/transactions/history/indexer/{schema,balance-impacts}.ts',
            // The boundary helpers themselves: they accept every raw shape they convert.
            '**/shared/src/utils/unit-conversion.ts',
        ],
    }),
    check(ctx, m) {
        const name = m.name
        if (name === undefined) return
        const annotation = annotationOf(ctx, name, m.type)
        if (annotation === undefined || !hasAlias(ctx, annotation)) {
            builtIn.check?.(ctx, m)
            return
        }
        const text = ctx.text(name) ?? ''
        if (!NAME_PATTERNS.some(pattern => pattern.test(text))) return
        if (leaves(ctx, annotation).some(leaf => isForbidden(ctx, leaf))) {
            ctx.report(name, { message: REASON })
        }
    },
})
