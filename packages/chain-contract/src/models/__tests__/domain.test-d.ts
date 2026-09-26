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

import type { Decimal } from 'decimal.js'
import { assertType, describe, expectTypeOf, it } from 'vitest'
import type {
    AccountChainState,
    AssetRef,
    ChainTransactionData,
    TransactionSummary,
    UnsignedTransaction,
} from '../domain'
import type { ChainFamily } from '../identity'

describe('TransactionSummary', () => {
    it('has exactly the seven chain-agnostic kinds', () => {
        expectTypeOf<TransactionSummary['kind']>().toEqualTypeOf<
            | 'transfer'
            | 'token-transfer'
            | 'nft-transfer'
            | 'contract-call'
            | 'approval'
            | 'swap'
            | 'chain-specific'
        >()
    })
})

describe('family unions', () => {
    it('AccountChainState has a variant for every chain family', () => {
        expectTypeOf<AccountChainState['family']>().toEqualTypeOf<ChainFamily>()
    })

    it('ChainTransactionData has a variant for every chain family', () => {
        expectTypeOf<
            ChainTransactionData['family']
        >().toEqualTypeOf<ChainFamily>()
    })

    it('narrows AccountChainState on family', () => {
        const narrow = (state: AccountChainState) => {
            if (state.family === 'algorand') {
                expectTypeOf(state.minBalance).toEqualTypeOf<Decimal>()
            }
        }
        expectTypeOf(narrow).toBeFunction()
    })
})

describe('AssetRef', () => {
    it('rejects a chain id that is a plain string', () => {
        const chainId: string = 'algorand'

        // @ts-expect-error chainId must be a ChainId
        assertType<AssetRef>({ chainId, assetId: '0' })
    })
})

describe('UnsignedTransaction', () => {
    it('keeps the payload opaque', () => {
        expectTypeOf<UnsignedTransaction['payload']>().toEqualTypeOf<unknown>()
    })
})
