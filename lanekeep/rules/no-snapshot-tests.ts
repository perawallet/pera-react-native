/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { TEST_FILES } from '../shared/scope.js'

export default defineRule({
    id: 'pera/no-snapshot-tests',
    severity: 'error',
    card: {
        message: 'a snapshot assertion',
        remediation:
            'Assert the specific fields the test is about. A snapshot passes whatever it first recorded, so it pins output rather than behaviour.',
        examples: {
            bad: 'expect(fees).toMatchSnapshot()',
            good: "expect(fees.total.toString()).toBe('0.001')",
        },
    },
    // Every snapshot matcher's name contains "Snapshot".
    gates: { pathMatches: [...TEST_FILES], fileContains: ['Snapshot'] },
    query: `
        ((call_expression
           function: (member_expression property: (property_identifier) @matcher))
         (#match? @matcher "^(toMatchSnapshot|toMatchInlineSnapshot|toThrowErrorMatchingSnapshot|toThrowErrorMatchingInlineSnapshot)$"))
    `,
    check(ctx, m) {
        const matcher = m.matcher
        if (matcher === undefined) return
        ctx.report(
            matcher,
            `${ctx.text(matcher) ?? 'a snapshot matcher'} pins recorded output; assert the fields the test is about`,
        )
    },
})
