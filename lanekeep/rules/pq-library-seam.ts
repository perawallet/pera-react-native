/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { PQ_SEAM_DIR, glob } from '../shared/firewall-paths.js'
import {
    IMPORT_SOURCES_QUERY,
    importSourceOf,
    isPackageOrSubpath,
} from '../shared/import-sources.js'

// Only an import position counts: 'falcon-1024' is also keystore-core's
// KeyType literal, which is not a dependency.
const isPqLibrary = (specifier: string): boolean =>
    specifier === '@joe-p/react-native-falcon' ||
    isPackageOrSubpath(specifier, 'falcon-1024')

export default defineRule({
    id: 'pera/pq-library-seam',
    severity: 'error',
    card: {
        message: 'a Falcon library is imported outside the kms PQ seam',
        remediation:
            'Go through the kms PQ provider in packages/kms/src/crypto/pq instead of importing falcon-1024 or @joe-p/react-native-falcon. Only the seam chooses between the WASM and the native backend. Build configs, tests and tools/ scripts are deliberately out of scope.',
        examples: {
            bad: "import { generateKey } from 'falcon-1024'",
            good: "import { getPQProvider } from '../crypto/pq'",
        },
    },
    gates: {
        fileContains: ['falcon'],
        pathMatches: ['**/apps/**', '**/packages/**'],
        pathNotMatches: [
            glob(PQ_SEAM_DIR),
            '**/apps/**/__tests__/**',
            '**/packages/**/__tests__/**',
            '**/e2e/**',
            '**/*.config.ts',
            '**/*.config.tsx',
        ],
    },
    query: IMPORT_SOURCES_QUERY,
    check(ctx, m) {
        const source = importSourceOf(ctx, m)
        if (source === undefined || !isPqLibrary(source.specifier)) return
        ctx.report(
            source.site,
            `${source.specifier} is imported outside ${PQ_SEAM_DIR}`,
        )
    },
})
