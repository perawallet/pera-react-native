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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { ALGORAND_CHAIN_ID } from '../../chain-id'

const mocks = vi.hoisted(() => ({
    fetchTransactionHistory: vi.fn(),
    fetchMoreTransactions: vi.fn(),
    fetchIndexerCloseAmount: vi.fn(),
}))

vi.mock('../history', () => ({
    fetchTransactionHistory: mocks.fetchTransactionHistory,
    fetchMoreTransactions: mocks.fetchMoreTransactions,
}))
vi.mock('../history/indexer/endpoints', () => ({
    fetchIndexerCloseAmount: mocks.fetchIndexerCloseAmount,
}))

import { algorandAssetInbox } from '../../asa-inbox/adapter'
import { algorandHistoryAdapter, algorandSendFlowAdapter } from '../adapter'

const testnet = scopeForLegacyNetwork('testnet')

describe('algorandSendFlowAdapter', () => {
    it('serves the Algorand chain with every optional feature', () => {
        expect(algorandSendFlowAdapter.chainId).toBe(ALGORAND_CHAIN_ID)
        expect(algorandSendFlowAdapter.assetInbox).toBe(algorandAssetInbox)
        expect(algorandSendFlowAdapter.express).toBeDefined()
        expect(algorandSendFlowAdapter.assetHolding).toBeDefined()
        expect(algorandSendFlowAdapter.rekey).toBeDefined()
        expect(algorandSendFlowAdapter.keyRegistration).toBeDefined()
    })
})

describe('algorandHistoryAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fetches the first page with the scope mapped back to its network', async () => {
        const page = { transactions: [] }
        mocks.fetchTransactionHistory.mockResolvedValueOnce(page)

        const result = await algorandHistoryAdapter.fetchHistory({
            scope: testnet,
            accountAddress: 'ADDR',
            limit: 10,
        })

        expect(result).toBe(page)
        expect(mocks.fetchTransactionHistory).toHaveBeenCalledWith({
            accountAddress: 'ADDR',
            limit: 10,
            network: 'testnet',
        })
    })

    it('fetches a later page with the scope mapped back to its network', async () => {
        await algorandHistoryAdapter.fetchMoreHistory({
            scope: testnet,
            url: 'NEXT',
        })

        expect(mocks.fetchMoreTransactions).toHaveBeenCalledWith({
            url: 'NEXT',
            network: 'testnet',
        })
    })

    it('looks a close amount up on the indexer', async () => {
        mocks.fetchIndexerCloseAmount.mockResolvedValueOnce('500')

        await expect(
            algorandHistoryAdapter.fetchCloseAmount!('TX', testnet),
        ).resolves.toBe('500')
        expect(mocks.fetchIndexerCloseAmount).toHaveBeenCalledWith(
            'TX',
            'testnet',
        )
    })

    it('rejects a scope that is not Algorand', async () => {
        const foreign = { chainId: 'other', networkId: 'main' }

        await expect(
            algorandHistoryAdapter.fetchHistory({
                scope: foreign as never,
                accountAddress: 'ADDR',
            }),
        ).rejects.toThrow('Not an Algorand scope')
        expect(mocks.fetchTransactionHistory).not.toHaveBeenCalled()
    })

    it('maps a payment row to its displayable form', () => {
        const item = {
            id: 'TX',
            txType: 'pay',
            sender: 'S',
            receiver: 'R',
            confirmedRound: 1,
            roundTime: 2,
            fee: new Decimal(1000),
            amount: new Decimal(5),
            closeTo: null,
            closeAmount: null,
        } as unknown as TransactionHistoryItem

        expect(algorandHistoryAdapter.toDisplayable(item)).toMatchObject({
            id: 'TX',
            paymentTransaction: { receiver: 'R' },
        })
    })
})
