/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { ownText, referencesQuery } from '../shared/references.js'

// Names from the custody design the keystore replaced. A comment naming them
// is as wrong as code calling them: it lies about where private keys live.
// Three match anywhere; the two short ones are word-bounded so
// decryptDatabase stays legal.
const RETIRED = new RegExp(
    'commitQuantumChildKey|storage/quantum-child|signWithQuantumSeed|\\bdecryptData\\b|\\bencryptData\\b',
)

export default defineRule({
    id: 'pera/no-retired-quantum-custody',
    severity: 'error',
    card: {
        message: 'names the retired quantum key-custody design',
        remediation:
            'The keystore now derives and holds quantum keys and signs internally. Use the kms keystore API, and describe that design in comments rather than the one it replaced.',
        examples: {
            bad: 'await signWithQuantumSeed(seedId, payload)',
            good: '// The keystore holds the quantum key; kms asks it to sign.',
        },
    },
    gates: {
        pathMatches: [
            '**/packages/*/src/**',
            '**/apps/*/src/**',
            '**/extensions/provider/src/**',
        ],
    },
    query: referencesQuery(RETIRED),
    check(ctx, m) {
        const token = m.token
        if (token === undefined) return
        const hit = RETIRED.exec(ownText(ctx, token))
        if (hit === null) return
        ctx.report(
            token,
            `"${hit[0]}" belongs to the retired quantum custody design`,
        )
    },
})
