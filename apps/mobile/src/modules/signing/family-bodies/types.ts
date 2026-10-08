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

import type { ComponentType } from 'react'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'

/** A transaction tagged with the chain family whose bodies render it; one member per registered family. */
export type FamilyTransaction = {
    family: 'algorand'
    transaction: PeraDisplayableTransaction
}

export type TransactionFamily = FamilyTransaction['family']

export type TransactionOfFamily<F extends TransactionFamily> = Extract<
    FamilyTransaction,
    { family: F }
>['transaction']

export type ReviewBodyProps<T> = {
    transaction: T
    source?: SignRequestSource
    /** Origin the platform observed (never dApp-asserted); gates the verified badge. */
    verifiedOrigin?: string
}

export type DetailBodyProps<T> = {
    transaction: T
    /** A transaction reachable from this one's body, such as an inner transaction. */
    onRelatedTransactionPress?: (transaction: T) => void
}

export type TransactionFamilyBodies<T> = {
    reviewBody: ComponentType<ReviewBodyProps<T>>
    detailBody: ComponentType<DetailBodyProps<T>>
}

export type TransactionBodyRegistry = {
    [F in TransactionFamily]: TransactionFamilyBodies<TransactionOfFamily<F>>
}
