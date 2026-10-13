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

import { describe, expect, it } from 'vitest'
import { AlgorandWalletConnectChainId } from '@perawallet/wallet-core-walletconnect'
import { algorandWalletConnectSupport as support } from '../connect/walletConnect'
import { algorandDescriptor } from '../descriptor'

describe('algorand descriptor and WalletConnect', () => {
    it.each(algorandDescriptor.networks)(
        "matches the descriptor's CAIP-2 id for $id and round-trips it",
        network => {
            const chainId = support.caip2ChainIdFor(network.id)

            expect(chainId).toBe(network.caip2)
            expect(support.networkForCaip2ChainId(chainId ?? '')).toBe(
                network.id,
            )
        },
    )

    it.each(algorandDescriptor.networks.map(network => network.id))(
        'accepts the any-Algorand-chain id on the declared network %s',
        networkId => {
            expect(
                support.v1?.isChainIdAcceptable(
                    AlgorandWalletConnectChainId.all,
                    networkId,
                ),
            ).toBe(true)
        },
    )
})
