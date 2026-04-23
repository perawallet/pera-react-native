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

export interface SignerResponse {
    address: string
    response: 'signed' | 'declined'
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
}
