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

import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'

/**
 * Encoder function type for signed transactions (see
 * `@perawallet/wallet-core-blockchain`'s `encodeSignedTransaction`; a
 * quantum signature is just a `pqsig` field on the same type, nothing
 * carrier-specific to handle).
 */
export type EncodeSignedTransactionsFn = (
    txns: PeraSignedTransaction[],
) => Uint8Array[]

/**
 * Algod client interface for submitting raw transactions.
 *
 * Mirrors algosdk v9's fluent builder shape: `sendRawTransaction(...)` returns
 * a request builder whose `.do()` performs the network call. The real
 * `AlgorandClient.client.algod` returns a `SendRawTransaction` builder here.
 */
export interface AlgodClientInterface {
    sendRawTransaction(rawTxns: Uint8Array | Uint8Array[]): {
        do(): Promise<unknown>
    }
}

/**
 * AlgorandClient-like interface with algod client access.
 */
export interface AlgokitClientInterface {
    client: {
        algod: AlgodClientInterface
    }
}
