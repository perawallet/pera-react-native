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

import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { toError, type Network } from '@perawallet/wallet-core-shared'
import type {
    DataTransport,
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../types'
import { NetworkChangedError, TransportError } from '../errors'

/**
 * Creates a transport that sends signed data back to a WalletConnect dApp.
 * The dApp is responsible for submitting to the network.
 *
 * @param capturedNetwork - The network that was active when the signing actor
 *   was created. The live network is re-checked before handing signed bytes
 *   back to the dApp — if the user switched networks mid-flow we abort so the
 *   dApp never receives signatures intended for the wrong chain.
 */
export const createWalletConnectTransport = (
    capturedNetwork: Network,
): DataTransport => {
    return {
        send: async (
            result: SigningResult,
            source: SourceMetadata,
            _multisigAddress?: string,
        ): Promise<TransportResult> => {
            // Verify we have callback functions
            if (!source.callbacks?.approve) {
                throw new TransportError(
                    'No approve callback provided for WalletConnect transport',
                )
            }

            if (!source.requestId) {
                throw new TransportError(
                    'No request ID provided for WalletConnect transport',
                )
            }

            const liveNetwork = useNetworkStore.getState().network
            if (liveNetwork !== capturedNetwork) {
                throw new NetworkChangedError(capturedNetwork, liveNetwork)
            }

            try {
                // Call the approve callback with the signing result
                await source.callbacks.approve(result)

                return {
                    type: 'callback-sent',
                    requestId: source.requestId,
                }
            } catch (error) {
                const err = toError(error)

                // Try to call error callback if available
                if (source.callbacks?.error) {
                    await source.callbacks.error(err)
                }

                throw new TransportError(err.message, err)
            }
        },
    }
}
