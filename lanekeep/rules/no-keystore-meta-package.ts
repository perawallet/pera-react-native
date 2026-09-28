/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import {
    IMPORT_SOURCES_QUERY,
    importSourceOf,
    isPackageOrSubpath,
} from '../shared/import-sources.js'

const META = '@algorandfoundation/keystore'

export default defineRule({
    id: 'pera/no-keystore-meta-package',
    severity: 'error',
    card: {
        message: 'the @algorandfoundation/keystore meta-package is imported',
        remediation:
            'Import the specific package instead: @algorandfoundation/react-native-keystore, keystore-core or keystore-web. Nothing in the workspace depends on the meta-package; extensions/keystore-chrome vendors the key types it needs.',
        examples: {
            bad: "import type { Key } from '@algorandfoundation/keystore/types'",
            good: "import type { Key } from '@algorandfoundation/keystore-core'",
        },
    },
    gates: {
        fileContains: [META],
        pathMatches: [
            '**/apps/*/src/**',
            '**/packages/*/src/**',
            '**/extensions/*/src/**',
        ],
    },
    query: IMPORT_SOURCES_QUERY,
    check(ctx, m) {
        const source = importSourceOf(ctx, m)
        if (source === undefined) return
        if (!isPackageOrSubpath(source.specifier, META)) return
        ctx.report(
            source.site,
            `${source.specifier} is the keystore meta-package`,
        )
    },
})
