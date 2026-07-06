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

import type { PeraTransaction } from '@perawallet/wallet-core-blockchain'

/**
 * Parameters for a payment transaction (ALGO or ASA)
 */
export interface PaymentSourceParams {
    /** Sender address */
    sender: string

    /** Receiver address */
    receiver: string

    /** Amount in base units (microAlgos or asset base units) */
    amount: bigint

    /** Asset ID (0 or undefined for ALGO) */
    assetId?: bigint

    /** Optional transaction note */
    note?: string

    /** Whether to close the account (send remaining balance to receiver) */
    isCloseAccount?: boolean
}

/**
 * Parameters for express send (opt-in funding + opt-in + transfer)
 */
export interface ExpressSendSourceParams {
    /** Sender address */
    sender: string

    /** Receiver address */
    receiver: string

    /** Amount in base units */
    amount: bigint

    /** Asset ID to transfer */
    assetId: bigint
}

/**
 * Dependencies required by source factories
 */
export interface SourceDependencies {
    /** Function to create a payment transaction */
    createPaymentTransaction: (params: {
        sender: string
        receiver: string
        amount: bigint
        closeRemainderTo?: string
        note?: string
        /** Fee in µAlgo the built transaction must carry (flat fee, PQ-aware, resolved per sender) */
        fee: bigint
    }) => Promise<PeraTransaction>

    /** Function to create an asset transfer transaction */
    createAssetTransferTransaction: (params: {
        sender: string
        receiver: string
        amount: bigint
        assetId: bigint
        note?: string
        /** Fee in µAlgo the built transaction must carry (flat fee, PQ-aware, resolved per sender) */
        fee: bigint
    }) => Promise<PeraTransaction>

    /** Function to create an asset opt-in transaction */
    createAssetOptInTransaction: (params: {
        sender: string
        assetId: bigint
        /** Fee in µAlgo the built transaction must carry (flat fee, PQ-aware, resolved per sender) */
        fee: bigint
    }) => Promise<PeraTransaction>

    /** Function to encode a transaction to bytes */
    encodeTransaction: (tx: PeraTransaction) => Uint8Array

    /** Function to get account information */
    getAccountInfo: (address: string) => Promise<{
        amount: bigint
        minBalance: bigint
    }>

    /** Function to get suggested transaction parameters */
    getSuggestedParams: () => Promise<{ minFee: bigint }>

    /** Minimum balance requirement for an asset */
    assetMbr: bigint

    /**
     * Resolves the minimum fee in µAlgo a transaction sent by
     * `senderAddress` must carry (PQ-aware: quantum-signed senders pay
     * base × multiplier). See minFeeResolver.ts for semantics.
     */
    resolveMinFeeForSender: (senderAddress: string) => Promise<bigint>
}
