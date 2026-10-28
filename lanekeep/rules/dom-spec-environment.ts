/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

const PRAGMA = /@vitest-environment\s+(jsdom|happy-dom)\b/
const ENVIRONMENT = /\benvironment:\s*['"]([\w-]+)['"]/

// Lazy prefix, so a scratch fixture's own `packages/<name>` resolves too.
const workspaceDir = (path: string): string | undefined =>
    /^((?:.*?\/)?(?:apps|packages|extensions)\/[^/]+)\//.exec(path)?.[1]

export default defineRule({
    id: 'pera/dom-spec-environment',
    severity: 'error',
    card: {
        message: 'a spec renders through Testing Library in a node environment',
        remediation:
            "Add `// @vitest-environment jsdom` after the license header. The workspace's vitest config runs specs in `node`, where `render` and `renderHook` throw `document is not defined`.",
        examples: {
            bad: "import { renderHook } from '@testing-library/react' // packages/accounts, environment: 'node'",
            good: "// @vitest-environment jsdom\nimport { renderHook } from '@testing-library/react'",
        },
    },
    // A helper beside the specs runs in whichever environment its importing
    // spec declares, so only spec files are checked. `act` and `waitFor` work
    // without a DOM.
    gates: {
        pathMatches: ['**/*.spec.{ts,tsx}'],
        fileContains: ['@testing-library/'],
    },
    query: `
        (import_statement
           (import_clause
              (named_imports (import_specifier name: (identifier) @name)))
           source: (string (string_fragment) @source)
           (#match? @source "^@testing-library/(react|dom)$")
           (#match? @name "^(render|renderHook|screen|fireEvent|within|cleanup)$")) @import
    `,
    check(ctx, m) {
        const at = m.import
        if (at === undefined || PRAGMA.test(ctx.fileText)) return
        const dir = workspaceDir(ctx.filePath)
        if (dir === undefined) return
        const config = ctx.readFile(`${dir}/vitest.config.ts`) ?? ''
        // Vitest's own default when the config names none.
        const environment = ENVIRONMENT.exec(config)?.[1] ?? 'node'
        if (environment !== 'node') return
        ctx.report(
            at,
            `${dir} runs specs in node; add \`// @vitest-environment jsdom\` so ${ctx.text(m.name ?? at)} has a DOM`,
        )
    },
})
