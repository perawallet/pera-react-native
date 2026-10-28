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

import { Decimal } from 'decimal.js'
import {
    DEFAULT_ASSET_METADATA,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    EVM_CHAIN_NETWORKS,
    type ChainDescriptor,
    type ChainNetwork,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { ethereumHdPath } from '../accounts/hd-derivation'
import type { EvmChain, EvmChainRow } from './types'

export const NATIVE_ASSET_ID = 'native'

// EIP-155 ids come from EVM_CHAIN_NETWORKS, not viem/chains: Metro ships every
// chain definition for any import of that barrel.
const networksOf = (row: EvmChainRow): readonly ChainNetwork[] =>
    EVM_CHAIN_NETWORKS[row.id].networks.map(network => ({
        id: network.id,
        tier: network.tier,
        displayName: network.displayName,
        isDefaultForTier: true,
        caip2: `eip155:${network.eip155ChainId}`,
        nativeRef: { kind: 'evm', eip155ChainId: network.eip155ChainId },
        status: 'active',
    }))

export const createEvmDescriptor = (row: EvmChainRow): ChainDescriptor => {
    const explorerLink =
        (path: string) =>
        (networkId: NetworkId, id: string): string | undefined => {
            const base = row.explorerBase[networkId]
            return base ? `${base}/${path}/${id}` : undefined
        }
    const tokenLink = explorerLink('token')

    return {
        id: row.id,
        family: 'evm',
        displayName: row.displayName,
        networks: networksOf(row),
        nativeAsset: {
            ref: { chainId: row.id, assetId: NATIVE_ASSET_ID },
            symbol: row.nativeAsset.symbol,
            name: row.nativeAsset.name,
            decimals: row.nativeAsset.decimals,
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
            supportsReplacement: true,
            supportsNativeMultisig: false,
            supportsRekey: false,
            hasTokenApproval: true,
            requiresAssetOptIn: false,
            confirmsOnSubmit: false,
        },
        explorer: {
            name: row.explorerName,
            accountUrl: explorerLink('address'),
            transactionUrl: explorerLink('tx'),
            // The native asset has no token page.
            assetUrl: (networkId, assetId) =>
                assetId === NATIVE_ASSET_ID
                    ? undefined
                    : tokenLink(networkId, assetId),
            // NFT ids are `{contract}/{token id}`: the explorer's own NFT path.
            collectibleUrl: explorerLink('nft'),
        },
        finality: row.finality,
        // Every EVM chain shares EIP-681's scheme; one deeplink adapter claims it.
        uriSchemes: ['ethereum'],
        enabledByDefault: row.enabledByDefault,
    }
}

export const createEvmNativeAsset = (row: EvmChainRow): PeraAsset => ({
    assetId: NATIVE_ASSET_ID,
    name: row.nativeAsset.name,
    unitName: row.nativeAsset.symbol,
    decimals: row.nativeAsset.decimals,
    // A chain's native coin has no fixed supply.
    totalSupply: new Decimal(0),
    creator: { address: '' },
    peraMetadata: {
        ...DEFAULT_ASSET_METADATA,
        verificationTier: PeraAssetVerificationTier.verified,
    },
})

/**
 * The native asset is built on first read, not when the table loads, and then
 * kept: memoised consumers compare it by identity.
 */
export const createEvmChain = (row: EvmChainRow): EvmChain => {
    let nativeAsset: PeraAsset | undefined
    return {
        row,
        descriptor: createEvmDescriptor(row),
        get nativeAsset() {
            nativeAsset ??= createEvmNativeAsset(row)
            return nativeAsset
        },
    }
}
