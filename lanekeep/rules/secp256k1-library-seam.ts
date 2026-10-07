/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { SECP256K1_SEAM_DIR, glob } from '../shared/firewall-paths.js'
import {
    IMPORT_SOURCES_QUERY,
    importSourceOf,
    isPackageOrSubpath,
} from '../shared/import-sources.js'

// `@noble/curves/secp256k1` is the implementation `@scure/bip32` runs on, so
// it is fenced too: otherwise the seam could be bypassed through it.
const isSecp256k1Library = (specifier: string): boolean =>
    isPackageOrSubpath(specifier, '@noble/secp256k1') ||
    isPackageOrSubpath(specifier, '@scure/bip32') ||
    /^@noble\/curves\/secp256k1(\.js)?$/.test(specifier)

export default defineRule({
    id: 'pera/secp256k1-library-seam',
    severity: 'error',
    card: {
        message:
            'a secp256k1 library is imported outside the keystore secp256k1 shim',
        remediation:
            'Derive, import and sign secp256k1 keys through the KMS (kmsCore or useKMS), which reach the keystore, instead of importing @noble/secp256k1, @scure/bip32 or @noble/curves/secp256k1. Only the keystore shim in extensions/provider/src/keystore/shims/secp256k1 handles the private key bytes. Build configs and tests are deliberately out of scope.',
        examples: {
            bad: "import { HDKey } from '@scure/bip32'",
            good: "import { kmsCore } from '@perawallet/wallet-core-kms'",
        },
    },
    // No `fileContains`: it requires every listed substring, and none covers
    // all three packages.
    gates: {
        pathMatches: ['**/apps/**', '**/packages/**', '**/extensions/**'],
        pathNotMatches: [
            glob(SECP256K1_SEAM_DIR),
            '**/apps/**/__tests__/**',
            '**/packages/**/__tests__/**',
            '**/extensions/**/__tests__/**',
            '**/e2e/**',
            '**/*.config.ts',
            '**/*.config.tsx',
        ],
    },
    query: IMPORT_SOURCES_QUERY,
    check(ctx, m) {
        const source = importSourceOf(ctx, m)
        if (source === undefined || !isSecp256k1Library(source.specifier)) {
            return
        }
        ctx.report(
            source.site,
            `${source.specifier} is imported outside ${SECP256K1_SEAM_DIR}`,
        )
    },
})
