/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { productionSource } from '../shared/scope.js'

export default defineRule({
    id: 'pera/no-raw-error-toast',
    severity: 'error',
    card: {
        message: 'error toast built by hand with showToast',
        remediation:
            'Surface an error value with showError(error, fallbackTitle) from useErrorToast (apps/mobile/src/hooks/useErrorToast.ts). Show copy with no error behind it, such as a failed validation or a step-specific failure message, with errorToast(title, body, options) from useToast (apps/mobile/src/hooks/useToast.ts).',
        examples: {
            bad: "showToast({ type: 'error', title, body })",
            good: 'errorToast(title, body)',
        },
    },
    gates: productionSource({
        fileContains: ['showToast'],
        // The two hooks are the only places allowed to build the error toast itself.
        pathNotMatches: [
            'apps/mobile/src/hooks/useErrorToast.ts',
            'apps/mobile/src/hooks/useToast.ts',
        ],
    }),
    query: `
        (call_expression
          function: [
            (identifier) @fn
            (member_expression property: (property_identifier) @fn)
          ]
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
            const literal =
                ctx.kind(value) === 'as_expression'
                    ? (ctx.namedChildren(value)[0] ?? value)
                    : value
            return (
                ctx.text(literal) === "'error'" ||
                ctx.text(literal) === '"error"'
            )
        })
        if (!hasErrorType) return

        ctx.report(
            call,
            'showToast builds an error toast by hand — use errorToast(title, body, options), or showError(error, fallbackTitle) to take the copy from an error',
        )
    },
})
