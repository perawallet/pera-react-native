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

import {
    decodeSignedTransaction,
    decodeTransaction,
    encodeSignedTransactions,
    getAlgorandClient,
    type PeraSignedTransaction,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { submitRawSignedTransactionGroup } from '@perawallet/wallet-core-signing'
import type { SwapChainAdapter } from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID } from '../chain-id'
import { executeAlgorandSwap } from './executeSwap'

// Swap groups arrive fully built from the backend, so the client only reads
// account state and submits; it never builds or signs with its own defaults.
export const algorandSwapAdapter: SwapChainAdapter = {
    chainId: ALGORAND_CHAIN_ID,
    executeSwap: (params, { assetOptInMinBalance, ...context }) =>
        executeAlgorandSwap(params, {
            ...context,
            algorandClient: getAlgorandClient(context.network),
            assetMbr: assetOptInMinBalance,
            decodeTransaction: bytes =>
                decodeTransaction(bytes) as PeraTransaction,
            decodeSignedTransaction: bytes =>
                decodeSignedTransaction(bytes) as PeraSignedTransaction,
            encodeSignedTransactions,
        }),
    submitSignedGroup: (network, signedTransactions) =>
        submitRawSignedTransactionGroup(
            getAlgorandClient(network),
            signedTransactions,
        ),
}
