/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

// Components and screens are PascalCase, hooks and helpers camelCase, so the
// spec's first letter says what it unit-tests.
const COMPONENT_SPEC = /^[A-Z][^/]*\.spec\.[jt]sx?$/

export default defineRule({
    id: 'pera/no-module-component-specs',
    severity: 'error',
    card: {
        message: 'a unit test of a module-level component or screen',
        remediation:
            'Delete the spec. Move the logic into a colocated use[Name] hook and unit-test the hook; cover the rendered flow by adding to or extending an integration flow in apps/mobile/src/__integration__/.',
        examples: {
            bad: 'modules/send/screens/SendScreen/__tests__/SendScreen.spec.tsx',
            good: 'modules/send/screens/SendScreen/__tests__/useSendScreen.spec.ts',
        },
    },
    // Navigator registration specs under routes/ test wiring, not a component.
    gates: {
        pathMatches: ['**/apps/mobile/src/modules/**/*.spec.{ts,tsx}'],
        pathNotMatches: ['**/routes/**'],
    },
    // A tree-sitter misparse can make the root ERROR rather than program.
    query: '[(program) (ERROR)] @file',
    check(ctx, m) {
        const file = m.file
        if (file === undefined || ctx.parent(file) !== undefined) return
        const name = ctx.filePath.split('/').pop() ?? ''
        if (!COMPONENT_SPEC.test(name)) return
        // Reported on the first top-level describe so a kept spec can take a
        // line suppression; line 1 is the copyright header.
        const describe = ctx.namedChildren(file).find(stmt => {
            if (ctx.kind(stmt) !== 'expression_statement') return false
            const [call] = ctx.namedChildren(stmt)
            if (call === undefined || ctx.kind(call) !== 'call_expression')
                return false
            const [fn] = ctx.namedChildren(call)
            return fn !== undefined && /^describe\b/.test(ctx.text(fn) ?? '')
        })
        ctx.report(
            describe ?? file,
            `${name} unit-tests a module component; test its use[Name] hook and cover the render in an integration flow`,
        )
    },
})
