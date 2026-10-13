/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { TEST_SUPPORT, productionSource } from '../shared/scope.js'

// A submit outside BroadcasterChainAdapter skips the attempt ledger and the post-confirmation refresh.
export const BROADCASTER_OWNERS = [
    'packages/chain-algorand/src',
    'packages/chain-ethereum/src',
] as const

const SUBMISSION_NAMES = [
    'sendRawTransaction',
    'submitRawSignedTransactionGroup',
    'submitSignedTransactionGroup',
]

export default defineRule({
    id: 'pera/submission-seam',
    severity: 'error',
    card: {
        message: 'submits to a node outside the chain broadcaster',
        remediation:
            "Submit through the chain's broadcaster: `submitSignedGroup(scope, bytes)` or `submitAndAutoRefresh(scope, signed, options)` from @perawallet/wallet-core-signing, or a transport from `createSubmitTransport`. Only the chain packages that implement BroadcasterChainAdapter call a node's submit endpoint.",
        examples: {
            bad: 'await algod.sendRawTransaction(bytes).do()',
            good: 'await submitSignedGroup(scope, bytes)',
        },
    },
    gates: productionSource({
        pathNotMatches: [
            ...TEST_SUPPORT,
            ...BROADCASTER_OWNERS.map(owner => `**/${owner}/**`),
        ],
    }),
    // Identifiers only, so a comment or string naming the call stays legal.
    query: `([(identifier) (property_identifier) (shorthand_property_identifier_pattern)] @name
        (#any-of? @name ${SUBMISSION_NAMES.map(name => `"${name}"`).join(' ')}))`,
    check(ctx, m) {
        if (m.name === undefined) return
        ctx.report(
            m.name,
            `${ctx.text(m.name)} submits outside ${BROADCASTER_OWNERS.join(' and ')}`,
        )
    },
})
