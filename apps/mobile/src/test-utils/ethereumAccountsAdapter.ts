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

import { accountsChainAdapters } from '@perawallet/wallet-core-accounts'
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import { deviceChainAdapters } from '@perawallet/wallet-core-device'
import { createEthereumAccountsAdapter } from '@packages/chain-ethereum/src/accounts/adapter'
import { evmChainOf } from '@packages/chain-ethereum/src/chains/table'
import { createEvmDeviceAdapter } from '@packages/chain-ethereum/src/device'

/**
 * Adds Ethereum signer resolution next to the Algorand adapter a spec
 * registered. Signer checks never reach the chain, so no context is needed.
 */
export const registerEthereumAccountsAdapter = (): void => {
    if (!accountsChainAdapters.has('ethereum')) {
        accountsChainAdapters.register(
            createEthereumAccountsAdapter(
                {} as ChainContext,
                evmChainOf('ethereum'),
            ),
        )
    }
}

/** Registers Ethereum accounts with the devices API the way the app bootstrap does. */
export const registerEthereumDeviceAdapter = (): void => {
    if (!deviceChainAdapters.has('ethereum')) {
        deviceChainAdapters.register(
            createEvmDeviceAdapter(evmChainOf('ethereum')),
        )
    }
}
