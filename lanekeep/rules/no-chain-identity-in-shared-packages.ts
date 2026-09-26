/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { withoutTests } from '../shared/scope.js'

/**
 * Mirrors `CHAIN_IDS` in packages/chain-contract/src/models/identity.ts, which
 * lanekeep's rule loader can't import. The spec fails until the two match.
 */
export const CHAIN_IDS = ['algorand'] as const

const SHARED_PACKAGES = [
    'chain-contract',
    'blockchain',
    'accounts',
    'assets',
    'transactions',
    'signing',
    'kms',
    'background',
    'connections',
    'walletconnect',
    // Product packages that keep their generic code here and reach the chain
    // through an adapter. asa-inbox and fee-delegation move whole, so they're out.
    'swaps',
    'card',
    'onramp',
    'nfd',
    'staking',
    'dapp',
    'multisig',
    'ledger',
    'backup',
    'migrate',
]

const IDENTITY_PROPS = '"chainId" "family"'
const EQUALITY_OPERATORS = new Set(['===', '!==', '==', '!='])

type Allowed = {
    file: string
    text: string
    reason: string
}

// Matched by path suffix plus the reported node's text. Only code that stays
// correct once every chain has its own package belongs here; debt stays
// reported.
const ALLOWED: readonly Allowed[] = [
    {
        file: 'packages/chain-contract/src/scope.ts',
        text: "'algorand'",
        reason: 'Legacy shim: every row stored before scope keys existed belongs to this chain.',
    },
    {
        file: 'packages/walletconnect/src/v2/handler.ts',
        text: 'event.params.chainId !== activeChainId',
        reason: "WalletConnect's chainId is a CAIP-2 string, not a ChainId.",
    },
    {
        file: 'packages/migrate/src/migrate/migrateWalletConnect.ts',
        text: 'fields.chainId != null',
        reason: "A legacy WalletConnect v1 session's chainId is its numeric chain id, not a ChainId.",
    },
]

export default defineRule({
    id: 'pera/no-chain-identity-in-shared-packages',
    // Existing chain literals in walletconnect and card move to the chain package
    // before this can block; the spec pins them so nothing new joins them.
    severity: 'warn',
    card: {
        message:
            'A chain-independent package must not branch on chain identity or name a chain',
        remediation:
            "Move the chain-specific behaviour into the chain's own package and reach it through the chain module or a capability. Code that is correct for every chain forever (a legacy shim, a non-ChainId field that happens to be called chainId) goes on the ALLOWED list in this rule with a one-line reason.",
        examples: {
            bad: "if (scope.chainId === 'algorand') {\n    return algodFee()\n}",
            good: '// The chain package supplies `chain`; this code never asks which one it is.\nreturn chain.estimateFee()',
        },
    },
    gates: withoutTests({
        pathMatches: [`**/packages/{${SHARED_PACKAGES.join(',')}}/src/**`],
        pathNotMatches: ['**/packages/chain-contract/src/models/identity.ts'],
    }),
    // ponytail: member access only, no type information, so a destructured
    // `switch (chainId)` is missed; walletconnect's CAIP-2 `chainId`s would
    // otherwise be false positives. Upgrade: `requires: ['types']` and match
    // on the ChainId type.
    query: `
        ((switch_statement
          value: (parenthesized_expression
            (member_expression property: (property_identifier) @prop)) @at)
         (#any-of? @prop ${IDENTITY_PROPS}))
        ((binary_expression
          left: (member_expression property: (property_identifier) @prop)
          operator: _ @op) @at
         (#any-of? @prop ${IDENTITY_PROPS}))
        ((binary_expression
          operator: _ @op
          right: (member_expression property: (property_identifier) @prop)) @at
         (#any-of? @prop ${IDENTITY_PROPS}))
        ((string (string_fragment) @lit) @at
         (#any-of? @lit ${CHAIN_IDS.map(id => `"${id}"`).join(' ')}))
    `,
    check(ctx, m) {
        const at = m.at
        if (at === undefined) return
        if (
            m.op !== undefined &&
            !EQUALITY_OPERATORS.has(ctx.text(m.op) ?? '')
        ) {
            return
        }

        const text = ctx.text(at) ?? ''
        const isAllowed = ALLOWED.some(
            entry => ctx.filePath.endsWith(entry.file) && entry.text === text,
        )
        if (isAllowed) return

        ctx.report(
            at,
            m.lit === undefined
                ? `\`${text}\` branches on chain identity in a shared package`
                : `\`${text}\` is a chain id literal in a shared package`,
        )
    },
})
