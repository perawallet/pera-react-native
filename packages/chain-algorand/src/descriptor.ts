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

import type {
    ChainDescriptor,
    ChainNetwork,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { getChainConfig } from '@perawallet/wallet-core-config'
import { ALGORAND_CHAIN_ID } from './chain-id'

// `custom` is left out: a custom node is user data with no genesis until probed.
// CAIP-2 references are the URL-safe first 32 characters of the genesis hash.
const networks: readonly ChainNetwork[] = [
    {
        id: 'mainnet',
        tier: 'mainnet',
        displayName: 'MainNet',
        isDefaultForTier: true,
        caip2: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
        nativeRef: {
            kind: 'algorand',
            genesisId: 'mainnet-v1.0',
            genesisHash: 'wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=',
        },
        status: 'active',
    },
    {
        id: 'testnet',
        tier: 'testnet',
        displayName: 'TestNet',
        isDefaultForTier: true,
        caip2: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
        nativeRef: {
            kind: 'algorand',
            genesisId: 'testnet-v1.0',
            genesisHash: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
        },
        status: 'active',
    },
    {
        id: 'betanet',
        tier: 'testnet',
        displayName: 'BetaNet',
        isDefaultForTier: false,
        caip2: 'algorand:mFgazF-2uRS1tMiL9dsj01hJGySEmPN2',
        nativeRef: {
            kind: 'algorand',
            genesisId: 'betanet-v1.0',
            genesisHash: 'mFgazF+2uRS1tMiL9dsj01hJGySEmPN28B/TjjvpVW0=',
        },
        status: 'active',
    },
]

const explorerLink =
    (path: string) =>
    (networkId: NetworkId, id: string): string | undefined => {
        if (!networks.some(network => network.id === networkId)) {
            return undefined
        }
        const { explorerUrl } = getChainConfig({
            chainId: ALGORAND_CHAIN_ID,
            networkId,
        })
        return explorerUrl ? `${explorerUrl}/${path}/${id}` : undefined
    }

export const algorandDescriptor: ChainDescriptor = {
    id: ALGORAND_CHAIN_ID,
    family: 'algorand',
    displayName: 'Algorand',
    networks,
    nativeAsset: {
        ref: { chainId: ALGORAND_CHAIN_ID, assetId: '0' },
        symbol: 'ALGO',
        name: 'Algo',
        decimals: 6,
    },
    signing: {
        schemes: ['ed25519', 'falcon-1024'],
        derivationPaths: {
            ed25519: (account, keyIndex) =>
                `m/44'/283'/${account}'/0/${keyIndex}`,
        },
    },
    protocol: {
        feeModel: 'flat',
        hasAccountNonce: false,
        requiresAssetOptIn: true,
        hasMinimumBalance: true,
        supportsAtomicGroups: true,
        supportsReplacement: false,
        supportsNativeMultisig: true,
        supportsRekey: true,
        multipleAddressesPerAccount: false,
    },
    explorer: {
        accountUrl: explorerLink('address'),
        transactionUrl: explorerLink('tx'),
        assetUrl: explorerLink('asset'),
    },
    finality: { kind: 'instant' },
}
