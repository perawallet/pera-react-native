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
    getAlgorandClient,
    type PeraEncodedTransactionSigner,
} from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'

// The card flows build groups a Ledger holder may have to confirm on-device;
// algokit's default window (~10 rounds) can expire first.
const VALIDITY_WINDOW_ROUNDS = 1000

// algokit's app client resolves a signer while building call params, so one
// must be set, but the groups are only ever signed by the signing pipeline.
const pipelineRoutedSigner: PeraEncodedTransactionSigner = async () => {
    throw new Error(
        'Card transactions are signed through the signing pipeline, not the AlgorandClient signer.',
    )
}

/** Configured like `useAlgorandClient` for building, never for signing. */
export const cardAlgorandClient = (network: Network) => {
    const client = getAlgorandClient(network)
    client.setDefaultValidityWindow(VALIDITY_WINDOW_ROUNDS)
    client.setDefaultSigner(pipelineRoutedSigner)
    return client
}
