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

/** Hardhat's first dev account: a well-known key and its address. */
export const HARDHAT_0_KEY_HEX =
    'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
export const HARDHAT_0_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const registerKeyChain = (id: string): void => {
    getProvider().chains.register(
        {
            id,
            family: 'evm',
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

/** Registers Ethereum as a chain this build backs up: descriptor with a private-key secret, cloud backup on. */
export const registerEthereumBackupChain = (): void => {
    registerKeyChain('ethereum')
}

/** A second chain of Ethereum's family, backed up the same way, with its accounts adapter. */
export const registerBaseBackupChain = (): void => {
    registerKeyChain('base')
    if (!accountsChainAdapters.has('base')) {
        accountsChainAdapters.register({
            chainId: 'base',
        } as unknown as AccountsChainAdapter)
    }
}

/** Registered so the chain counts as backed up; specs that reveal a key spread
 *  their own `revealPrivateKey` over it. */
export const ethereumAccountsAdapter = {
    chainId: 'ethereum',
} as unknown as AccountsChainAdapter

/** Registered once per file: the adapter registry has no per-test reset. */
export const registerEthereumAccountsAdapter = (): void => {
    if (!accountsChainAdapters.has('ethereum')) {
        accountsChainAdapters.register(ethereumAccountsAdapter)
    }
}

/** The scope chain counts as backed up only with its accounts adapter
 *  registered, as `chain-algorand` does in the app. */
export const registerAlgorandAccountsAdapter = (): void => {
    if (!accountsChainAdapters.has('algorand')) {
        accountsChainAdapters.register({
            chainId: 'algorand',
            hdKeyPairId: (
                seedKeyId: string,
                { account, keyIndex }: { account: number; keyIndex: number },
            ) => `${seedKeyId}-algorand-${account}-${keyIndex}`,
        } as unknown as AccountsChainAdapter)
    }
}
