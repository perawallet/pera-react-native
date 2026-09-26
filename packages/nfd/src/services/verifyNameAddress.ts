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

import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { Network } from '@perawallet/wallet-core-shared'
import { nameServiceAdapterFor } from '../chain-adapter'
import type { NfdAddressVerification } from '../models'

export type VerifyNameAddressParams = {
    name: string
    address: string
    network: Network
    signal?: AbortSignal
}

/**
 * Checks a name's backend-asserted address against the chain itself, so
 * neither Pera's backend nor a third-party registry can vouch for an address.
 * @throws ChainAdapterNotRegisteredError when the network's chain registered
 * no name service adapter, which is a bootstrap bug rather than a verdict.
 */
export const verifyNameAddress = async ({
    name,
    address,
    network,
    signal,
}: VerifyNameAddressParams): Promise<NfdAddressVerification> => {
    const adapter = nameServiceAdapterFor(network)
    // Without an on-chain check there is nothing to trust the address on, so
    // the name stays unusable as a destination rather than passing unchecked.
    if (!adapter.verifyForwardResolution) return 'unavailable'
    return adapter.verifyForwardResolution({
        name,
        address,
        scope: scopeForLegacyNetwork(network),
        signal,
    })
}
