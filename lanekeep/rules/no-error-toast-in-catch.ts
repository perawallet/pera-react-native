/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, RuleContext } from 'lanekeep'

// Walking outward stops at these: a function boundary means the toast is no
// longer lexically inside the handler, even if the handler encloses it.
const SCOPE_BOUNDARIES = new Set([
    'function_declaration',
    'method_definition',
    'class_declaration',
    'program',
])

/** True when `node` sits inside a `catch` clause or a `.catch(cb)` callback. */
function insideCatchScope(ctx: RuleContext, node: Node): boolean {
    for (const ancestor of ctx.ancestors(node)) {
        const kind = ctx.kind(ancestor)
        if (kind === 'catch_clause') return true
        if (kind === 'arrow_function' || kind === 'function_expression') {
            return isCatchCallback(ctx, ancestor)
        }
        if (kind !== undefined && SCOPE_BOUNDARIES.has(kind)) return false
    }
    return false
}

/** True when `fn` is the first argument of a `.catch(...)` call. */
function isCatchCallback(ctx: RuleContext, fn: Node): boolean {
    const args = ctx.parent(fn)
    if (args === undefined || ctx.kind(args) !== 'arguments') return false
    if (ctx.namedChildren(args)[0] !== fn) return false
    const call = ctx.parent(args)
    if (call === undefined || ctx.kind(call) !== 'call_expression') return false
    const callee = ctx.namedChildren(call)[0]
    if (callee === undefined || ctx.kind(callee) !== 'member_expression') {
        return false
    }
    const property = ctx.namedChildren(callee).at(-1)
    return property !== undefined && ctx.text(property) === 'catch'
}

export default defineRule({
    id: 'pera/no-error-toast-in-catch',
    severity: 'error',
    card: {
        message: 'error toast raised from a caught exception',
        remediation:
            'Use showError(error, fallbackTitle) from useErrorToast (apps/mobile/src/hooks/useErrorToast.ts) instead of showToast({ type: "error", ... }) when surfacing a caught exception.',
        examples: {
            bad: "catch { showToast({ type: 'error', title: t }) }",
            good: 'catch (error) { showError(error, t) }',
        },
    },
    gates: {
        fileContains: ['showToast'],
        // The hook is the one place allowed to build the error toast itself.
        pathNotMatches: ['apps/mobile/src/hooks/useErrorToast.ts'],
    },
    query: `
        (call_expression
          function: (identifier) @fn
          arguments: (arguments (object) @arg)
          (#eq? @fn "showToast")) @call
    `,
    check(ctx, m) {
        const call = m.call
        const arg = m.arg
        if (call === undefined || arg === undefined) return

        const hasErrorType = ctx.namedChildren(arg).some(pair => {
            if (ctx.kind(pair) !== 'pair') return false
            const [key, value] = ctx.namedChildren(pair)
            if (key === undefined || value === undefined) return false
            if (ctx.text(key) !== 'type') return false
            return (
                ctx.text(value) === "'error'" || ctx.text(value) === '"error"'
            )
        })
        if (!hasErrorType) return
        if (!insideCatchScope(ctx, call)) return

        ctx.report(call)
    },
})
