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

import { getAddress, isAddress, type Address } from 'viem'
import type {
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import {
    AppError,
    ErrorCategory,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../../chains/types'

export class UnknownEvmNetworkError extends AppError {
    readonly scope: ChainScope

    constructor(scope: ChainScope) {
        super(`${scope.chainId}/${scope.networkId} is not an EVM network`, {
            category: ErrorCategory.NETWORK,
        })
        this.name = 'UnknownEvmNetworkError'
        this.scope = scope
    }
}

export class InvalidCaip19Error extends AppError {
    readonly caip19: string

    constructor(caip19: string, scope: ChainScope) {
        super(
            `${caip19} is not an asset on ${scope.chainId}/${scope.networkId}`,
            { category: ErrorCategory.ASSETS },
        )
        this.name = 'InvalidCaip19Error'
        this.caip19 = caip19
    }
}

const CAIP19_PATTERN =
    /^eip155:(\d+)\/(erc20|slip44|erc721|erc1155):([^/]+)(?:\/(\d+))?$/

export type EvmNftStandard = 'erc721' | 'erc1155'

export const EVM_NFT_STANDARD_LABELS: Readonly<Record<EvmNftStandard, string>> =
    { erc721: 'ERC-721', erc1155: 'ERC-1155' }

const isNftStandard = (namespace: string | undefined): boolean =>
    namespace === 'erc721' || namespace === 'erc1155'

const MAX_UINT256 = (1n << 256n) - 1n
const DECIMAL_PATTERN = /^\d+$/

// Token ids are uint256: past 2^53, so they stay decimal strings, never numbers.
const toTokenId = (tokenId: string): Nullable<string> => {
    if (!DECIMAL_PATTERN.test(tokenId)) return null
    const value = BigInt(tokenId)
    return value <= MAX_UINT256 ? value.toString() : null
}

/** An NFT's app asset id: `{checksummed contract}/{decimal token id}`. */
export const toEvmNftAssetId = (contract: string, tokenId: string): string => {
    const id = toTokenId(tokenId)
    if (id === null) {
        throw new RangeError(`${tokenId} is not a uint256 token id`)
    }
    return `${getAddress(contract)}/${id}`
}

export const parseEvmNftAssetId = (
    assetId: string,
): Nullable<{ contract: Address; tokenId: string }> => {
    const [contract, tokenId, ...rest] = assetId.split('/')
    if (rest.length > 0 || !contract || tokenId === undefined) return null
    if (!isAddress(contract)) return null
    const id = toTokenId(tokenId)
    return id === null ? null : { contract: getAddress(contract), tokenId: id }
}

export const isEvmNftAssetId = (assetId: string): boolean =>
    parseEvmNftAssetId(assetId) !== null

export const eip155ChainIdOfNetwork = (
    chain: EvmChain,
    networkId: NetworkId | undefined,
): number | undefined => {
    const nativeRef = chain.descriptor.networks.find(
        n => n.id === networkId,
    )?.nativeRef
    return nativeRef?.kind === 'evm' ? nativeRef.eip155ChainId : undefined
}

export const networkIdOf = (
    chain: EvmChain,
    eip155ChainId: number,
): NetworkId | undefined =>
    chain.descriptor.networks.find(
        n =>
            n.nativeRef.kind === 'evm' &&
            n.nativeRef.eip155ChainId === eip155ChainId,
    )?.id

export const eip155ChainIdOf = (scope: ChainScope, chain: EvmChain): number => {
    const eip155ChainId = eip155ChainIdOfNetwork(chain, scope.networkId)
    if (scope.chainId !== chain.row.id || eip155ChainId === undefined) {
        throw new UnknownEvmNetworkError(scope)
    }
    return eip155ChainId
}

/**
 * The backend's id for an app asset id; addresses go out lowercase. An NFT id
 * doesn't carry its standard, so the caller passes it.
 */
export const toCaip19 = (
    assetId: string,
    scope: ChainScope,
    chain: EvmChain,
    standard?: EvmNftStandard,
): string => {
    const chainId = eip155ChainIdOf(scope, chain)
    if (assetId === chain.nativeAsset.assetId)
        return `eip155:${chainId}/slip44:${chain.row.nativeAsset.slip44}`
    const nft = parseEvmNftAssetId(assetId)
    if (nft) {
        if (!standard) throw new InvalidCaip19Error(assetId, scope)
        return `eip155:${chainId}/${standard}:${nft.contract.toLowerCase()}/${nft.tokenId}`
    }
    return `eip155:${chainId}/erc20:${getAddress(assetId).toLowerCase()}`
}

/**
 * The app asset id (checksummed address, NFT id, or the native id) for a
 * backend id on the scope's chain.
 */
export const fromCaip19 = (
    caip19: string,
    scope: ChainScope,
    chain: EvmChain,
): string => {
    const chainId = eip155ChainIdOf(scope, chain)
    const [, idChain, namespace, reference, tokenId] =
        CAIP19_PATTERN.exec(caip19) ?? []
    if (idChain === String(chainId) && reference) {
        if (isNftStandard(namespace)) {
            const id =
                tokenId !== undefined && isAddress(reference)
                    ? toTokenId(tokenId)
                    : null
            if (id !== null) return toEvmNftAssetId(reference, id)
        } else if (tokenId === undefined) {
            if (
                namespace === 'slip44' &&
                reference === chain.row.nativeAsset.slip44
            ) {
                return chain.nativeAsset.assetId
            }
            if (namespace === 'erc20' && isAddress(reference)) {
                return getAddress(reference)
            }
        }
    }
    throw new InvalidCaip19Error(caip19, scope)
}
