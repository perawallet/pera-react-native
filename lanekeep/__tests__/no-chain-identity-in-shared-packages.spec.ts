/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { CHAIN_IDS } from '../../packages/chain-contract/src/models/identity.js'
import { CHAIN_IDS as RULE_CHAIN_IDS } from '../rules/no-chain-identity-in-shared-packages.js'
import { locations, runRule } from './helpers.js'

const RULE = 'lanekeep/rules/no-chain-identity-in-shared-packages.ts'
const FIXTURES =
    'lanekeep/__tests__/fixtures/packages/*/src/chain-identity.*.ts'

// Debt the chain-split moves out of shared packages. Remove an entry when its
// line goes; flip the rule to `error` when the list is empty.
const KNOWN_OFFENDERS: readonly string[] = [
    'packages/blockchain/src/store/custom-network-store.ts: `scope.chainId !== CUSTOM_SCOPE.chainId` branches on chain identity in a shared package',
    'packages/blockchain/src/store/custom-network-store.ts: `scope.chainId !== CUSTOM_SCOPE.chainId` branches on chain identity in a shared package',
    "packages/card/src/api/delegation/endpoints.ts: `'algorand'` is a chain id literal in a shared package",
    "packages/card/src/api/delegation/endpoints.ts: `'algorand'` is a chain id literal in a shared package",
    "packages/walletconnect/src/shared/deeplink.ts: `'algorand'` is a chain id literal in a shared package",
    "packages/walletconnect/src/v2/caip.ts: `'algorand'` is a chain id literal in a shared package",
]

describe('pera/no-chain-identity-in-shared-packages', () => {
    it('reports branches on chainId/family and chain id literals', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('chain-identity.bad.ts')),
            ),
        ).toEqual([
            'chain-identity.bad.ts:8',
            'chain-identity.bad.ts:14',
            'chain-identity.bad.ts:17',
            'chain-identity.bad.ts:18',
            'chain-identity.bad.ts:19',
            'chain-identity.bad.ts:20',
        ])
    })

    it('ignores calls, comments, look-alike strings, object keys and other props', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('chain-identity.good.ts')),
        ).toEqual([])
    })

    it('scans the product packages that stay generic', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            locations(
                found.filter(v => v.file.endsWith('chain-identity.product.ts')),
            ),
        ).toEqual(['chain-identity.product.ts:8'])
    })

    it('leaves packages outside the shared list alone', async () => {
        const found = await runRule(RULE, FIXTURES)

        expect(
            found.filter(v => v.file.endsWith('chain-identity.outside.ts')),
        ).toEqual([])
    })

    it('bans every ChainId', () => {
        expect(RULE_CHAIN_IDS).toEqual(CHAIN_IDS)
    })

    it('reports exactly the known offenders across the real packages', async () => {
        const found = await runRule(RULE, 'packages/*/src/**/*.{ts,tsx}')

        expect(found.map(v => `${v.file}: ${v.message}`)).toEqual(
            KNOWN_OFFENDERS,
        )
    })
})
