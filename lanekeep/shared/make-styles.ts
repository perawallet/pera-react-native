/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import type { Node, RuleContext } from 'lanekeep'

// Every `makeStyles(...)` call. Rules refine from the call node.
//
// The identifier is matched literally rather than resolved, so an aliased
// `import { makeStyles as ms }` would be missed. The old runner resolved the
// binding; nothing in the repo uses an alias, and `check` re-verifies the
// origin below, so the literal match costs no real coverage and keeps every
// non-makeStyles call from crossing the sandbox boundary.
export const MAKE_STYLES_QUERY =
    '(call_expression function: (identifier) @fn (#eq? @fn "makeStyles")) @call'

export interface StyleEntry {
    key: string
    keyNode: Node
    /** The object literal the key maps to. */
    value: Node
}

const named = (ctx: RuleContext, node: Node, kind: string): Node | undefined =>
    ctx.namedChildren(node).find(c => ctx.kind(c) === kind)

/** Rejects a local function that merely shares the name. */
export function isRneuiMakeStyles(ctx: RuleContext, fn: Node): boolean {
    return ctx.resolvesToImport(fn, '@rneui/themed', 'makeStyles')
}

/**
 * The object literal the callback returns, for both forms the codebase uses:
 * a concise `theme => ({...})` body, and a block body with a `return`.
 */
function returnedObject(ctx: RuleContext, call: Node): Node | undefined {
    const args = named(ctx, call, 'arguments')
    if (args === undefined) return undefined
    const fn = ctx
        .namedChildren(args)
        .find(
            c =>
                ctx.kind(c) === 'arrow_function' ||
                ctx.kind(c) === 'function_expression',
        )
    if (fn === undefined) return undefined

    const paren = named(ctx, fn, 'parenthesized_expression')
    if (paren !== undefined) return named(ctx, paren, 'object')

    const block = named(ctx, fn, 'statement_block')
    if (block === undefined) return undefined
    for (const stmt of ctx.namedChildren(block)) {
        if (ctx.kind(stmt) !== 'return_statement') continue
        const direct = named(ctx, stmt, 'object')
        if (direct !== undefined) return direct
        const wrapped = named(ctx, stmt, 'parenthesized_expression')
        if (wrapped !== undefined) return named(ctx, wrapped, 'object')
    }
    return undefined
}

/**
 * Top-level style entries only. A nested object such as `shadowOffset` is a
 * value, not an entry, and walking it as one would report its inner keys.
 */
export function styleEntries(ctx: RuleContext, call: Node): StyleEntry[] {
    const obj = returnedObject(ctx, call)
    if (obj === undefined) return []
    const out: StyleEntry[] = []
    for (const pair of ctx.namedChildren(obj)) {
        if (ctx.kind(pair) !== 'pair') continue
        const [keyNode, value] = ctx.namedChildren(pair)
        if (keyNode === undefined || value === undefined) continue
        const kind = ctx.kind(keyNode)
        if (kind !== 'property_identifier' && kind !== 'string') continue
        if (ctx.kind(value) !== 'object') continue
        const raw = ctx.text(keyNode)
        if (raw === undefined) continue
        out.push({
            key: kind === 'string' ? raw.slice(1, -1) : raw,
            keyNode,
            value,
        })
    }
    return out
}
