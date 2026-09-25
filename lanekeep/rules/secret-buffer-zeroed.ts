/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

const ACQUIRE =
    '^(seedFromMnemonic|mnemonicToSeed|mnemonicToEntropy|derivePQKeygenSeed)$'

export default defineRule({
    id: 'pera/secret-buffer-zeroed',
    severity: 'error',
    requires: ['dataflow'],
    card: {
        message: 'a secret buffer is not zeroed on every path',
        remediation:
            'Zero it in a finally block, with zeroBytes(buffer) from packages/kms/src/crypto/secure-memory.ts or buffer.fill(0), so every return and throw clears the key material from memory.',
        examples: {
            bad: 'const seed = seedFromMnemonic(phrase)\nreturn sign(seed)',
            good: 'const seed = seedFromMnemonic(phrase)\ntry { return sign(seed) } finally { seed.fill(0) }',
        },
    },
    gates: productionSource({ pathNotMatches: [...TEST_SUPPORT] }),
    obligation: {
        acquire: [
            `((call_expression function: (identifier) @fn) @acquire @key (#match? @fn "${ACQUIRE}"))`,
            `((call_expression function: (member_expression property: (property_identifier) @fn)) @acquire @key (#match? @fn "${ACQUIRE}"))`,
        ],
        release: [
            '((call_expression function: (member_expression object: (_) @key property: (property_identifier) @method) arguments: (arguments (number) @zero)) @release (#eq? @method "fill") (#eq? @zero "0"))',
            '((call_expression function: (identifier) @fn arguments: (arguments . (_) @key)) @release (#eq? @fn "zeroBytes"))',
        ],
        scope: 'function',
        // A release discharges only the buffer it zeroes, not every
        // acquisition in the function.
        keyBy: 'binding',
    },
    checkObligation(ctx, unmet) {
        ctx.report(
            unmet.exit,
            unmet.partial
                ? 'the secret buffer is zeroed on some paths, not all'
                : 'the secret buffer is never zeroed',
        )
    },
})
