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

import { describe, expectTypeOf, it } from 'vitest'
import {
    readAlgorandNative,
    type AlgorandTransactionKind,
    type AlgorandTransactionView,
} from '../transaction-view'
import type { PeraDisplayableTransaction } from '../algosdk-shapes'

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

    it('reads its own member back out of a TransactionNative', () => {
        expectTypeOf(
            readAlgorandNative,
        ).returns.toEqualTypeOf<AlgorandTransactionView | null>()
    })
})
