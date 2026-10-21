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

import { customNodeAdapters } from '@perawallet/wallet-core-chain-shared'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { ConnectionHandler } from '@perawallet/wallet-core-connections'
import {
    createDappConnectionHandler,
    createNoopDappTransport,
} from '@perawallet/wallet-core-dapp'
import { createWalletConnectV1Handler } from '@perawallet/wallet-core-walletconnect'

type AlgorandDescriptorHandlersDeps = {
    getNetworkId: (chainId: ChainId) => NetworkId
}

/**
 * WalletConnect v1 and the `window.pera` dApp protocol speak Algorand only, so
 * their descriptor handlers live with the Algorand UI. Descriptor-only: a UI
 * realm answers URI and method queries, and the offscreen host owns the live
 * handlers.
 */
export const createAlgorandDescriptorHandlers = ({
    getNetworkId,
}: AlgorandDescriptorHandlersDeps): ConnectionHandler[] => [
    createWalletConnectV1Handler({
        chainId: LEGACY_CHAIN_ID,
        getNetworkId,
    }),
    createDappConnectionHandler({
        transport: createNoopDappTransport(),
        chainId: LEGACY_CHAIN_ID,
        getNetworkId,
        getCustomNetworkGenesisHash: () =>
            customNodeAdapters.has(LEGACY_CHAIN_ID)
                ? customNodeAdapters.get(LEGACY_CHAIN_ID).read()?.genesisHash
                : undefined,
        getAccounts: () => [],
    }),
]
