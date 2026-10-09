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
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '@perawallet/wallet-core-accounts'
import type { ChainDescriptor } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { CLOUD_BACKUP_ONLY } from './cloudBackupOnly'
import { stubAccountsAdapter } from './stubAccountsAdapter'

/** Hardhat's first dev account: a well-known key and its address. */
export const HARDHAT_0_KEY_HEX =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
export const HARDHAT_0_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

/** Registers Ethereum as a chain this build backs up: descriptor with a private-key secret, cloud backup on. */
export const registerEthereumBackupChain = (): void => {
    getProvider().chains.register(
        {
            id: 'ethereum',
            signing: {
                schemes: ['secp256k1'],
                derivationPaths: {},
                rawKeySchemes: ['secp256k1'],
                standaloneSecret: 'privateKey',
            },
        } as unknown as ChainDescriptor,
        CLOUD_BACKUP_ONLY,
    )
}

/** Only what `buildAccount` and the private-key resolver ask of an accounts adapter. */
export const ethereumAccountsAdapter = {
    ...stubAccountsAdapter,
    chainId: 'ethereum',
} as AccountsChainAdapter

/** Registered once per file: the adapter registry has no per-test reset. */
export const registerEthereumAccountsAdapter = (): void => {
    if (!accountsChainAdapters.has('ethereum')) {
        accountsChainAdapters.register(ethereumAccountsAdapter)
    }
}
