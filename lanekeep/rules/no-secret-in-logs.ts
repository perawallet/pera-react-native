/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

// The calls that turn a mnemonic into key material, and the fields that hold
// it. A new derivation or key field must be added here, or the rule is blind
// to it.
const SECRET_CALLS =
    '^(seedFromMnemonic|mnemonicToSeed|mnemonicToEntropy|derivePQKeygenSeed|resolveMnemonic|consumePendingImportMnemonic)$'
const SECRET_FIELDS = '^(privateKey|secretKey|mnemonic)$'

export default defineRule({
    id: 'pera/no-secret-in-logs',
    severity: 'error',
    requires: ['dataflow'],
    card: {
        message: 'secret key material reaches a log, analytics or error sink',
        remediation:
            'Log that the operation happened, never the material. Mnemonics, seeds and entropy must not reach a logger, the console, an analytics event or an Error message, which crash reports carry off the device.',
        examples: {
            bad: "logger.error('import failed', seed)",
            good: "logger.error('import failed')",
        },
    },
    gates: productionSource({ pathNotMatches: [...TEST_SUPPORT] }),
    flow: {
        sources: [
            `((call_expression function: (identifier) @fn) @source (#match? @fn "${SECRET_CALLS}"))`,
            `((call_expression function: (member_expression property: (property_identifier) @fn)) @source (#match? @fn "${SECRET_CALLS}"))`,
            `((member_expression property: (property_identifier) @field) @source (#match? @field "${SECRET_FIELDS}"))`,
        ],
        // Taint doesn't pass through a template string on its own, so each
        // substitution is a sink too. A `+` concatenation, or a template bound
        // to a variable first, still goes unreported.
        sinks: [
            '((call_expression function: (member_expression object: (identifier) @object) arguments: (arguments (_) @sink)) (#match? @object "^(logger|console)$"))',
            '((call_expression function: (member_expression object: (identifier) @object) arguments: (arguments (template_string (template_substitution (_) @sink)))) (#match? @object "^(logger|console)$"))',
            '((call_expression function: (member_expression object: (identifier) @object property: (property_identifier) @method) arguments: (arguments (_) @sink)) (#eq? @object "analytics") (#eq? @method "logEvent"))',
            '((new_expression constructor: (identifier) @ctor arguments: (arguments (_) @sink)) (#match? @ctor "Error$"))',
            '((new_expression constructor: (identifier) @ctor arguments: (arguments (template_string (template_substitution (_) @sink)))) (#match? @ctor "Error$"))',
        ],
    },
    checkFlow(ctx, path) {
        ctx.report(path.sink, 'secret key material reaches this sink')
    },
})
