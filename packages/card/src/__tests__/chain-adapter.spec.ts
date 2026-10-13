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

import { beforeEach, describe, expect, it } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    ChainAdapterNotRegisteredError,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { cardAdapterFor, cardChainAdapters } from '../chain-adapter'
import {
    buildCardManualDeposit,
    describeCardChainError,
    getCardFundingSourceEligibility,
    getCardSettlementAssetId,
    getCardTransactionUrl,
} from '../hooks/cardChain'
import { fakeCardAdapter, registerFakeCardAdapter } from './fakeCardAdapter'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'testnet' }

describe('cardAdapterFor', () => {
    beforeEach(() => {
        cardChainAdapters.reset()
    })

    it("resolves a scope to its chain's adapter", () => {
        const adapter = fakeCardAdapter()
        cardChainAdapters.register(adapter)

        expect(cardAdapterFor(SCOPE)).toBe(adapter)
    })

    it('names the missing feature when no adapter is registered', () => {
        expect(() => cardAdapterFor(SCOPE)).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => cardAdapterFor(SCOPE)).toThrow(
            'No card adapter is registered for chain "algorand"',
        )
    })
})

describe('chain-backed card helpers', () => {
    it('fail closed when no adapter is registered', () => {
        cardChainAdapters.reset()

        expect(() => getCardSettlementAssetId(SCOPE)).toThrow(
            ChainAdapterNotRegisteredError,
        )
        expect(() => describeCardChainError(new Error('x'), SCOPE)).toThrow(
            ChainAdapterNotRegisteredError,
        )
    })

    it('ask the adapter for the given scope', async () => {
        const account = { address: 'FUNDING' } as WalletAccount
        const error = new Error('x')
        const deposit = { sender: 'FUNDING', cardAddress: 'CARD', amount: 5n }
        const adapter = registerFakeCardAdapter({
            describeError: () => 'insufficient-native-balance',
            transactionUrl: () => 'https://explorer/tx/HASH',
        })

        expect(getCardSettlementAssetId(SCOPE)).toBe('31566704')
        expect(adapter.settlementAsset).toHaveBeenCalledWith(SCOPE)
        await buildCardManualDeposit(deposit, SCOPE)
        expect(adapter.buildManualDeposit).toHaveBeenCalledWith(deposit, SCOPE)
        expect(getCardFundingSourceEligibility(account, SCOPE).canFund).toBe(
            true,
        )
        expect(adapter.fundingSourceEligibility).toHaveBeenCalledWith(
            account,
            SCOPE,
        )
        expect(describeCardChainError(error, SCOPE)).toBe(
            'insufficient-native-balance',
        )
        expect(getCardTransactionUrl('HASH', 'algorand', SCOPE)).toBe(
            'https://explorer/tx/HASH',
        )
    })
})
