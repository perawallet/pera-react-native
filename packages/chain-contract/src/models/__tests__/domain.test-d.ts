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
import type { PeraDisplayableTransaction } from '../algorand-display'
import type {
    AccountChainState,
    AlgorandTransactionKind,
    AlgorandTransactionView,
    AssetOptInIntent,
    AssetRef,
    ChainTransactionData,
    FeePreset,
    TransactionIntent,
    TransactionNative,
    TransactionSummary,
    TransferIntent,
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

describe('TransactionIntent', () => {
    it('is a transfer or an asset opt-in, told apart by kind', () => {
        expectTypeOf<TransactionIntent>().toEqualTypeOf<
            TransferIntent | AssetOptInIntent
        >()
        expectTypeOf<TransactionIntent['kind']>().toEqualTypeOf<
            'transfer' | 'asset-opt-in'
        >()
    })

    it('carries a transfer amount as a Decimal', () => {
        expectTypeOf<TransferIntent['amount']>().toEqualTypeOf<Decimal>()
    })
})

describe('FeePreset', () => {
    it('is slow, normal or fast', () => {
        expectTypeOf<FeePreset>().toEqualTypeOf<'slow' | 'normal' | 'fast'>()
    })
})

describe('AlgorandTransactionView', () => {
    type WithKind<K extends keyof PeraDisplayableTransaction> =
        PeraDisplayableTransaction &
            Required<Pick<PeraDisplayableTransaction, K>>

    it('AlgorandTransactionKind has exactly the twelve kinds', () => {
        expectTypeOf<AlgorandTransactionKind>().toEqualTypeOf<
            | 'payment'
            | 'asset-transfer'
            | 'asset-opt-in'
            | 'asset-opt-out'
            | 'asset-clawback'
            | 'asset-config'
            | 'asset-freeze'
            | 'key-registration'
            | 'app-call'
            | 'state-proof'
            | 'heartbeat'
            | 'unknown'
        >()
    })

    it('accepts a PeraDisplayableTransaction of every kind', () => {
        expectTypeOf<PeraDisplayableTransaction>().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'paymentTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'assetTransferTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'assetConfigTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'assetFreezeTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'keyregTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'applicationTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'heartbeatTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            WithKind<'stateProofTransaction'>
        >().toExtend<AlgorandTransactionView>()
        expectTypeOf<
            NonNullable<PeraDisplayableTransaction['innerTxns']>[number]
        >().toExtend<AlgorandTransactionView>()
    })

    it('keeps the raw transaction opaque', () => {
        expectTypeOf<
            AlgorandTransactionView['rawTransaction']
        >().toEqualTypeOf<unknown>()
    })

    it('narrows TransactionNative on family', () => {
        const narrow = (native: TransactionNative) => {
            if (native.family === 'algorand') {
                expectTypeOf(
                    native.transaction,
                ).toEqualTypeOf<AlgorandTransactionView>()
            }
        }
        expectTypeOf(narrow).toBeFunction()
    })
})
