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

import type { Network } from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    PeraEncodedTransactionSigner,
    PeraTransactionGroup,
    PeraTransactionSigner,
} from '../models'
import { encodeSignedTransactions } from './transact'
import { createTimeoutBoundedAlgorandClient } from './createAlgorandClient'
import { resolveChainEndpoints } from './algorandClient'

const pipelineRoutedSigner: PeraEncodedTransactionSigner = async () => {
    throw new Error(
        'AlgorandClient default signer should not be invoked: signing is routed through the XState pipeline. Use useSignAndSubmitGroup instead.',
    )
}

/**
 * The client the wallet builds transaction groups with, as `useAlgorandClient`
 * returns it, for code that runs outside React. Unlike `getAlgorandClient` it
 * carries the wallet's validity window, so groups built with it survive a
 * hardware-wallet confirmation.
 */
export const createWalletAlgorandClient = (
    network: Network,
    signer?: PeraTransactionSigner,
) => {
    const client = createTimeoutBoundedAlgorandClient(
        resolveChainEndpoints(network),
    )
    // algokit-utils defaults this to 10 rounds (~30s) on non-localnet,
    // which expires before a hardware-wallet user can confirm on-device.
    // 1000 rounds (~50min) matches the standard Algorand SDK default.
    client.setDefaultValidityWindow(1000)
    if (signer) {
        const encodingSigner: PeraEncodedTransactionSigner = async (
            txnGroup: PeraTransactionGroup,
            indexesToSign: number[],
        ) => {
            try {
                const txs = await signer(txnGroup, indexesToSign)
                return encodeSignedTransactions(txs)
            } catch (e) {
                logger.error('Transaction signing/encoding failed', {
                    error: e,
                })
                throw e
            }
        }
        client.setDefaultSigner(encodingSigner)
    } else {
        client.setDefaultSigner(pipelineRoutedSigner)
    }
    return client
}
