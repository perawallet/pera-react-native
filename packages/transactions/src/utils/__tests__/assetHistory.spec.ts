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

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    i18nKey,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { isRecordInAssetHistory } from '../assetHistory'

// The real package needs a platform provider; EVM's codec compares case-blind.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    isSameAddress: (_chainId: string, a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    isNativeAssetId: (_chainId: string, assetId: string) =>
        assetId === 'NATIVE',
}))

const ME = '0xabc'
const TOKEN = '0xtoken'
const OTHER_TOKEN = '0xother'

const recordOf = (
    summary: Partial<TransactionSummary> = {},
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: '0xhash',
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    fee: new Decimal(21_000),
    initiator: ME,
    summary: {
        kind: 'approval',
        title: { key: i18nKey('transactions.list_item.approval') },
        direction: 'none',
        icon: 'approval',
        ...summary,
    },
    chainData: { family: 'evm' },
    ...overrides,
})

const ref = (assetId: string) => ({ chainId: 'ethereum', assetId })

describe('isRecordInAssetHistory', () => {
    it('Given a record whose amount is the asset, then it is in the asset history', () => {
        const record = recordOf({
            amount: { assetRef: ref(TOKEN), value: new Decimal(1) },
        })

        expect(isRecordInAssetHistory(record, TOKEN, ME)).toBe(true)
    })

    it('Given a record with a balance change in the asset, then it is in the asset history', () => {
        const record = recordOf({
            balanceChanges: [
                { assetRef: ref('NATIVE'), value: new Decimal(-1) },
                { assetRef: ref(TOKEN), value: new Decimal(2) },
            ],
        })

        expect(isRecordInAssetHistory(record, TOKEN, ME)).toBe(true)
    })

    it('Given a record moving another asset, then it is not in the asset history', () => {
        const record = recordOf({
            amount: { assetRef: ref(OTHER_TOKEN), value: new Decimal(1) },
        })

        expect(isRecordInAssetHistory(record, TOKEN, ME)).toBe(false)
    })

    it('Given a call that moved nothing and the account paid for, then the native asset keeps it', () => {
        expect(isRecordInAssetHistory(recordOf(), 'NATIVE', ME)).toBe(true)
    })

    it('Given a call that moved nothing and another address paid for, then the native asset drops it', () => {
        const record = recordOf({}, { initiator: '0xdef' })

        expect(isRecordInAssetHistory(record, 'NATIVE', ME)).toBe(false)
    })

    it('Given a call that moved nothing, then a token does not keep it', () => {
        expect(isRecordInAssetHistory(recordOf(), TOKEN, ME)).toBe(false)
    })
})
