/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

const BANNED: Record<string, string> = {
    Text: 'PWText',
    View: 'PWView',
    ScrollView: 'PWScrollView',
    FlatList: 'PWFlatList',
    TouchableOpacity: 'PWTouchableOpacity',
    Image: 'PWImage',
    Switch: 'PWSwitch',
}

export default defineRule({
    id: 'pera/no-primitive-rn-components',
    severity: 'error',
    card: {
        message: 'primitive react-native component imported directly',
        remediation:
            "Import the PW wrapper from '@components/core' (see apps/mobile/src/components/core/index.ts).",
        examples: {
            bad: "import { View } from 'react-native'",
            good: "import { PWView } from '@components/core'",
        },
    },
    gates: {
        fileContains: ['react-native'],
        // The wrappers themselves must import the primitives they wrap.
        pathNotMatches: ['apps/mobile/src/components/core/**'],
    },
    query: `
        (import_statement
          (import_clause (named_imports (import_specifier) @spec))
          (string (string_fragment) @src)
          (#eq? @src "react-native"))
    `,
    check(ctx, m) {
        const spec = m.spec
        if (spec === undefined) return

        const parts = ctx.children(spec)
        // `import { type Foo }` — the specifier carries its own `type` child.
        if (parts.some(p => ctx.kind(p) === 'type')) return
        // `import type { Foo }` — the `type` sits on the declaration instead.
        const stmt = ctx.closestAncestor(spec, '(import_statement) @s')?.s
        if (
            stmt !== undefined &&
            ctx.children(stmt).some(p => ctx.kind(p) === 'type')
        ) {
            return
        }

        // For `{ Foo as Bar }` the first identifier is the imported name,
        // which is the one that must be checked against the ban list.
        const imported = parts.find(p => ctx.kind(p) === 'identifier')
        if (imported === undefined) return
        const name = ctx.text(imported)
        if (name === undefined) return

        const pw = BANNED[name]
        if (pw === undefined) return
        ctx.report(
            spec,
            `Use ${pw} from @components/core instead of ${name} from 'react-native'`,
        )
    },
})
