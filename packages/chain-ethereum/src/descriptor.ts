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
import { ETHEREUM_CHAIN_ID } from './chain-id'
import { ethereumHdPath } from './keys/path'

// EIP-155 ids are declared here, not read from viem/chains: Metro ships every
// chain definition for any import of that barrel.
const networks: readonly ChainNetwork[] = [
    {
        id: 'mainnet',
        tier: 'mainnet',
        displayName: 'Mainnet',
        isDefaultForTier: true,
        caip2: 'eip155:1',
        nativeRef: { kind: 'evm', eip155ChainId: 1 },
        status: 'active',
    },
    {
        id: 'sepolia',
        tier: 'testnet',
        displayName: 'Sepolia',
        isDefaultForTier: true,
        caip2: 'eip155:11155111',
        nativeRef: { kind: 'evm', eip155ChainId: 11_155_111 },
        status: 'active',
    },
]

const NATIVE_ASSET_ID = 'native'

const EXPLORER_BASE: Partial<Record<NetworkId, string>> = {
    mainnet: 'https://etherscan.io',
    sepolia: 'https://sepolia.etherscan.io',
}

const explorerLink =
    (path: string) =>
    (networkId: NetworkId, id: string): string | undefined => {
        const base = EXPLORER_BASE[networkId]
        return base ? `${base}/${path}/${id}` : undefined
    }

const tokenLink = explorerLink('token')

export const ethereumDescriptor: ChainDescriptor = {
    id: ETHEREUM_CHAIN_ID,
    family: 'evm',
    displayName: 'Ethereum',
    networks,
    nativeAsset: {
        ref: { chainId: ETHEREUM_CHAIN_ID, assetId: NATIVE_ASSET_ID },
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
    },
    signing: {
        schemes: ['secp256k1'],
        derivationPaths: {
            secp256k1: ethereumHdPath,
        },
        rawKeySchemes: ['secp256k1'],
        standaloneSecret: 'privateKey',
    },
    protocol: {
        feeModel: 'gas',
        hasAccountNonce: true,
        requiresAssetOptIn: false,
        hasMinimumBalance: false,
        supportsAtomicGroups: false,
        supportsReplacement: true,
        supportsNativeMultisig: false,
        supportsRekey: false,
        hasTokenApproval: true,
        multipleAddressesPerAccount: false,
    },
    explorer: {
        accountUrl: explorerLink('address'),
        transactionUrl: explorerLink('tx'),
        // The native asset has no token page.
        assetUrl: (networkId, assetId) =>
            assetId === NATIVE_ASSET_ID
                ? undefined
                : tokenLink(networkId, assetId),
    },
    finality: { kind: 'confirmations', recommended: 12 },
    uriSchemes: ['ethereum'],
}
