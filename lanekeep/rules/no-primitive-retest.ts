/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

// Coarse and name-based: it reads only the title, so a test named like a
// smoke test is reported whatever its body asserts. Anchored so a title that
// names behaviour ("renders children when offline") passes.
const PRIMITIVE_RETEST = [
    /^renders( correctly| children( correctly)?)?$/i,
    /^renders without crashing\b/i,
    /^renders correctly (with|in) /i,
    /^(forwards|passes|attaches)\b.*\btestid\b/i,
]

export default defineRule({
    id: 'pera/no-primitive-retest',
    severity: 'error',
    card: {
        message: 'a test that re-tests React Native primitives',
        remediation:
            'Assert behaviour instead: an interaction, a callback firing, or a conditional branch rendering. A core component with no behavioural case may keep one smoke test, kept behind a pera/no-primitive-retest suppression whose reason says why there is nothing else to assert (lanekeep/README.md, Suppressing).',
        examples: {
            bad: "it('renders correctly', () => { render(<PWBadge />) })",
            good: "it('fires onPress when tapped', () => { ... })",
        },
    },
    gates: {
        pathMatches: [
            '**/apps/mobile/**/__tests__/**',
            '**/apps/mobile/**/*.spec.{ts,tsx}',
        ],
    },
    query: `
        ((call_expression
           function: (identifier) @fn
           arguments: (arguments) @args) @call
         (#match? @fn "^(it|test)$"))
    `,
    check(ctx, m) {
        const call = m.call
        const args = m.args
        if (call === undefined || args === undefined) return
        const [title] = ctx.namedChildren(args)
        if (title === undefined) return
        const kind = ctx.kind(title)
        const text = ctx.text(title) ?? ''
        if (kind !== 'string' && kind !== 'template_string') return
        const name = text.slice(1, -1)
        if (!PRIMITIVE_RETEST.some(re => re.test(name))) return
        ctx.report(
            call,
            `"${name}" re-tests a primitive; assert an interaction, a callback or a conditional branch`,
        )
    },
})
