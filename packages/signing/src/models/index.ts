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
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { BaseStoreState } from '@perawallet/wallet-core-shared'
import type { Arc60Data, SourceType } from '../pipeline/types'

export type SignRequestSource = {
    name?: string
    description?: string
    url?: string
    icons?: string[]
}

type BaseSignRequest = {
    id: string
    type: 'transactions' | 'arbitrary-data' | 'arc60'
    transport: 'algod' | 'callback'
    transportId?: string
    /** Origin of the request. Defaults to 'local' when not specified. */
    sourceType?: SourceType
    sourceMetadata?: SignRequestSource
}

export type TransactionSignRequest = {
    txs: PeraTransaction[]
    approve?: (signedTxs: PeraSignedTransaction[]) => Promise<void>
    reject?: () => Promise<void>
    error?: (error: string) => Promise<void>
} & BaseSignRequest

export type PeraArbitraryDataMessage = {
    signer: string
    data: string
    message?: string
    chainId: number
}

export type PeraArbitraryDataSignResult = {
    signature: Uint8Array
    signer: string
}

export type ArbitraryDataSignRequest = {
    data: PeraArbitraryDataMessage[]
    approve?: (signed: PeraArbitraryDataSignResult[]) => Promise<void>
    reject?: () => Promise<void>
    error?: (error: string) => Promise<void>
} & BaseSignRequest

export type Arc60SignRequest = {
    signer: string
    structuredData: Arc60Data
    approve?: (signed: PeraArbitraryDataSignResult[]) => Promise<void>
    reject?: () => Promise<void>
    error?: (error: string) => Promise<void>
} & BaseSignRequest

export type SignRequest =
    | TransactionSignRequest
    | ArbitraryDataSignRequest
    | Arc60SignRequest

export type SigningStore = BaseStoreState & {
    pendingSignRequests: SignRequest[]
    lastCompletedRequest: SignRequest | null
    addSignRequest: (request: SignRequest) => boolean
    removeSignRequest: (request: SignRequest) => boolean
    setLastCompletedRequest: (request: SignRequest | null) => void
}

export type TransactionWarning = {
    type: 'close' | 'rekey' | 'asset-freeze'
    senderAddress: string
    targetAddress: string
}

export {
    isTransactionRequest,
    isArbitraryDataRequest,
    isArc60Request,
} from './guards'
