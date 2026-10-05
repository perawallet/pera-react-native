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
import type {
    Address,
    SignedTransaction,
    Transaction,
    indexerModels,
} from 'algosdk'
import type {
    AccountInformation,
    PeraDisplayableTransaction,
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'

// The reference shape the indexer copies must match: algosdk's indexer classes
// minus their encoding methods.
type PlainModel<T> = T extends Uint8Array
    ? T
    : // oxlint-disable-next-line typescript/no-explicit-any
      T extends (...args: any[]) => any
      ? never
      : T extends (infer U)[]
        ? PlainModel<U>[]
        : T extends object
          ? {
                [
                    // oxlint-disable-next-line typescript/no-explicit-any
                    K in keyof T as T[K] extends (...args: any[]) => any
                        ? never
                        : K
                ]: PlainModel<T[K]>
            }
          : T

type KeysOnlyIn<A, B> = Exclude<keyof A, keyof B>

type TypeSpecificField =
    | 'payment'
    | 'keyreg'
    | 'assetConfig'
    | 'assetTransfer'
    | 'assetFreeze'
    | 'applicationCall'
    | 'stateProof'
    | 'heartbeat'

type MissingFromCopy<K extends TypeSpecificField> = K extends TypeSpecificField
    ? KeysOnlyIn<NonNullable<Transaction[K]>, NonNullable<PeraTransaction[K]>>
    : never

describe('chain-contract Algorand copies match algosdk', () => {
    it('accepts every algosdk value', () => {
        expectTypeOf<Transaction>().toExtend<PeraTransaction>()
        expectTypeOf<SignedTransaction>().toExtend<PeraSignedTransaction>()
        expectTypeOf<indexerModels.Transaction>().toExtend<PeraDisplayableTransaction>()
        expectTypeOf<Address>().toExtend<AccountInformation['address']>()
    })

    it('copies every public member except the encoding schema and deprecated signers', () => {
        expectTypeOf<KeysOnlyIn<Transaction, PeraTransaction>>().toEqualTypeOf<
            'getEncodingSchema' | 'rawSignTxn' | 'signTxn'
        >()
        expectTypeOf<KeysOnlyIn<PeraTransaction, Transaction>>().toBeNever()
        expectTypeOf<
            KeysOnlyIn<SignedTransaction, PeraSignedTransaction>
        >().toEqualTypeOf<'getEncodingSchema'>()
        expectTypeOf<MissingFromCopy<TypeSpecificField>>().toBeNever()
    })

    it('matches the indexer model field for field', () => {
        expectTypeOf<
            Omit<
                PeraDisplayableTransaction,
                'roundTimeMillis' | 'rawTransaction' | 'innerTransactionCount'
            >
        >().toEqualTypeOf<PlainModel<indexerModels.Transaction>>()
    })
})
