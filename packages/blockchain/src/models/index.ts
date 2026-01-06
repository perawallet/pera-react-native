/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type {
    SignedTransaction,
    Transaction,
} from '@algorandfoundation/algokit-utils/transact'

export const MAX_TX_NOTE_BYTES = 1024

export type SignRequestSource = {
    name?: string
    description?: string
    url?: string
    icons?: string[]
}

type BaseSignRequest = {
    id?: string
    type: 'transactions' | 'arbitrary-data' | 'arc60'
    transport: 'algod' | 'callback'
    transportId?: string
    sourceMetadata?: SignRequestSource
    message?: string
    addresses?: string[]
}

export type TransactionSignRequest = {
    // A list of transaction groups (which in turn are a list of transactions) - nulls are used to represent transactions that the caller does not need signed
    txs: (Transaction | null)[][]
    success?: (signedTxs: (PeraSignedTransaction | null)[]) => Promise<void>
    error?: (error: string) => Promise<void>
} & BaseSignRequest

export type PeraArbitraryDataMessage = {
    data: string // base64 encoded
    message?: string // optional message to display to the user
}

export type ArbitraryDataSignRequest = {
    // A raw data blob to sign
    data: string // base64 encoded
    success?: (signingAddress: string, signature: Uint8Array) => Promise<void>
    error?: (error: string) => Promise<void>
} & BaseSignRequest

//ARC 60 arbitrary data signing request
export type Arc60SignRequest = {
    //TODO add data in here that matches the expected structure
    success?: (signingAddress: string, signature: Uint8Array) => Promise<void>
    error?: (error: string) => Promise<void>
} & BaseSignRequest

export type SignRequest =
    | TransactionSignRequest
    | ArbitraryDataSignRequest
    | Arc60SignRequest

export type BlockchainStore = {
    pendingSignRequests: SignRequest[]
    addSignRequest: (request: SignRequest) => boolean
    removeSignRequest: (request: SignRequest) => boolean
}

export { Address } from '@algorandfoundation/algokit-utils'

export type PeraTransaction = Transaction

export type PeraTransactionGroup = PeraTransaction[]

export type PeraSignedTransaction = SignedTransaction

export type PeraTransactionSigner = (
    txnGroup: PeraTransactionGroup,
    indexesToSign: number[],
) => Promise<PeraSignedTransaction[]>

export type PeraEncodedTransactionSigner = (
    txnGroup: PeraTransactionGroup,
    indexesToSign: number[],
) => Promise<Uint8Array[]>
