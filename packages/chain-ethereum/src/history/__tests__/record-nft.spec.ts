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

import { describe, expect, it } from 'vitest'
import {
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { readEvmRecordNft } from '../record-nft'

const recordOf = (
    chainData: TransactionRecord['chainData'],
): TransactionRecord => ({
    id: 'tx',
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    status: 'confirmed',
    summary: {
        kind: 'nft-transfer',
        title: { key: i18nKey('transactions.list_item.receive') },
        icon: 'receive',
        direction: 'in',
    },
    chainData,
})

describe('readEvmRecordNft', () => {
    it("reads an EVM record's NFT, and none from a record without one or of another family", () => {
        const nft = {
            standard: 'erc1155',
            collectionName: 'Storefront',
        } as const

        expect(readEvmRecordNft(recordOf({ family: 'evm', nft }))).toEqual(nft)
        expect(readEvmRecordNft(recordOf({ family: 'evm' }))).toBeUndefined()
        expect(
            readEvmRecordNft(recordOf({ family: 'algorand' })),
        ).toBeUndefined()
    })
})
