/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    addAccountToken,
    deleteAllAddedTokensForAccount,
    getAccountAddedTokens,
    getAddedTokenIdsByAccount,
    removeAccountToken,
} from '../addedTokensRepository'
import { getAccountHoldings, insertAssetHolding } from '../holdingsRepository'

const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const
const BASE = { chainId: 'base', networkId: 'mainnet' } as const
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

describe('added tokens repository', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('lists each account its own tokens on the scope asked', async () => {
        await addAccountToken({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: USDC,
        })
        await addAccountToken({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: USDC,
        })
        await addAccountToken({
            db,
            accountAddress: 'A',
            scope: BASE,
            assetId: DAI,
        })

        const byAccount = await getAddedTokenIdsByAccount({
            db,
            accountAddresses: ['A', 'B'],
            scope: ETHEREUM,
        })

        expect(byAccount).toEqual(
            new Map([
                ['A', [USDC]],
                ['B', []],
            ]),
        )
    })

    it('reports whether an added token has a balance', async () => {
        await addAccountToken({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: USDC,
        })
        await addAccountToken({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: DAI,
        })
        await insertAssetHolding({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: USDC,
        })
        await insertAssetHolding({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: DAI,
            amount: new Decimal(5),
        })

        const tokens = await getAccountAddedTokens({
            db,
            sources: [{ address: 'A', scope: ETHEREUM }],
        })

        expect(tokens).toEqual(
            expect.arrayContaining([
                { scope: ETHEREUM, assetId: USDC, hasBalance: false },
                { scope: ETHEREUM, assetId: DAI, hasBalance: true },
            ]),
        )
    })

    it('drops a zero holding with the token but keeps a held one', async () => {
        for (const assetId of [USDC, DAI]) {
            await addAccountToken({
                db,
                accountAddress: 'A',
                scope: ETHEREUM,
                assetId,
            })
        }
        await insertAssetHolding({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: USDC,
        })
        await insertAssetHolding({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: DAI,
            amount: new Decimal(5),
        })

        await removeAccountToken({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: USDC,
        })
        await removeAccountToken({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: DAI,
        })

        const holdings = await getAccountHoldings({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
        })
        expect(holdings.map(h => h.assetId)).toEqual([DAI])
        expect(
            await getAccountAddedTokens({
                db,
                sources: [{ address: 'A', scope: ETHEREUM }],
            }),
        ).toEqual([])
    })

    it('deletes every added token of a removed account', async () => {
        await addAccountToken({
            db,
            accountAddress: 'A',
            scope: ETHEREUM,
            assetId: USDC,
        })
        await addAccountToken({
            db,
            accountAddress: 'B',
            scope: ETHEREUM,
            assetId: USDC,
        })

        await deleteAllAddedTokensForAccount({ db, accountAddress: 'A' })

        const byAccount = await getAddedTokenIdsByAccount({
            db,
            accountAddresses: ['A', 'B'],
            scope: ETHEREUM,
        })
        expect(byAccount.get('A')).toEqual([])
        expect(byAccount.get('B')).toEqual([USDC])
    })
})
