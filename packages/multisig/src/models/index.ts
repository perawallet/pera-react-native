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
import type { Nullable } from '@perawallet/wallet-core-shared'

export interface MultiSigAccount {
    customId: string
    createdAt: Date
    address: string
    version: number
    threshold: number
    participantAddresses: string[]
}

export type SignRequestStatus =
    | 'pending'
    | 'ready'
    | 'submitting'
    | 'confirmed'
    | 'failed'
    | 'expired'
    | 'declined'

/**
 * How the backend should dispatch the multisig propose call:
 *   - `'async'` — backend collects signatures and (eventually) broadcasts
 *     to algod itself. Used for in-app Send flows.
 *   - `'sync'` — wallet is responsible for delivering the assembled signed
 *     bytes back to the dApp once threshold is met. Used for WalletConnect
 *     / webview / deeplink handoffs.
 */
export type MultisigProposeMode = 'sync' | 'async'

export interface SignerResponse {
    address: string
    response: 'signed' | 'declined'
    /**
     * Per-transaction signatures from this participant, base64-encoded.
     * Same order as the enclosing `TransactionList.rawTransactions` array;
     * nullable entries mean "this participant didn't sign this index".
     * Populated only by the `getSignRequestsWithSignatures` endpoint —
     * other endpoints (search, propose/cosign responses) omit it.
     */
    signatures?: Nullable<string>[]
}

export interface TransactionList {
    id: string
    rawTransactions: string[]
    firstValidBlock: number
    lastValidBlock: number
    expectedExpireDatetime: Date
    responses: SignerResponse[]
}

export interface MultisigSignRequest {
    id: string
    status: SignRequestStatus
    type: string
    createdAt: Date
    expectedExpireDatetime: Date
    failReasonDisplay: Nullable<string>
    multisigAccount: MultiSigAccount
    transactionLists: TransactionList[]
    proposerAddress: Nullable<string>
}
