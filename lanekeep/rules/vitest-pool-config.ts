/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'

const SETUP_FILES = `
    (pair
       key: (property_identifier) @key
       value: (array) @files
       (#eq? @key "setupFiles")) @pair
`

const PACKAGE_CONFIG =
    /(?:^|\/)(?:packages|extensions)\/[^/]+\/vitest\.config\.ts$/

export default defineRule({
    id: 'pera/vitest-pool-config',
    severity: 'error',
    card: {
        message: 'a vitest config skips the shared pool or its globals setup',
        remediation:
            "Spread `poolConfig` into `test` and list `vmGlobalsSetup` first in every `setupFiles`, both from `@perawallet/wallet-core-devtools/vitest/pool`. Without the pool a package boots a process per spec file; without the setup msw and WebCrypto users fail under vmThreads. A `pool: 'forks'` project is exempt from the setup.",
        examples: {
            bad: "test: { ...poolConfig, setupFiles: ['./vitest.setup.ts'] }",
            good: "test: { ...poolConfig, setupFiles: [vmGlobalsSetup, './vitest.setup.ts'] }",
        },
    },
    gates: {
        pathMatches: ['**/{apps,packages,extensions}/*/vitest.config.ts'],
    },
    query: '(program) @file',
    check(ctx, m) {
        const file = m.file
        if (file === undefined) return
        if (!ctx.fileText.includes('...poolConfig')) {
            if (PACKAGE_CONFIG.test(ctx.filePath)) {
                ctx.report(file, 'spread `poolConfig` into `test`')
            }
            return
        }
        const setups = ctx.querySubtree(file, SETUP_FILES)
        if (setups.length === 0) {
            ctx.report(file, 'list `vmGlobalsSetup` in `setupFiles`')
            return
        }
        for (const { pair, files } of setups) {
            if (pair === undefined || files === undefined) continue
            const owner = ctx.parent(pair)
            const isForks =
                owner !== undefined &&
                ctx
                    .namedChildren(owner)
                    .some(p =>
                        /^pool:\s*['"]forks['"]$/.test(ctx.text(p) ?? ''),
                    )
            if (isForks) continue
            const [first] = ctx.namedChildren(files)
            if (first !== undefined && ctx.text(first) === 'vmGlobalsSetup') {
                continue
            }
            ctx.report(files, 'list `vmGlobalsSetup` first in `setupFiles`')
        }
    },
})
