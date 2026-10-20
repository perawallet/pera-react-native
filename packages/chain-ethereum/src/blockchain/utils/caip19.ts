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

import { getAddress, isAddress } from 'viem'
import type {
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { EvmChain } from '../../chains/types'

export class UnknownEvmNetworkError extends Error {
    readonly scope: ChainScope

    constructor(scope: ChainScope) {
        super(`${scope.chainId}/${scope.networkId} is not an EVM network`)
        this.name = 'UnknownEvmNetworkError'
        this.scope = scope
    }
}

export class InvalidCaip19Error extends Error {
    readonly caip19: string

    constructor(caip19: string, scope: ChainScope) {
        super(
            `${caip19} is not an asset on ${scope.chainId}/${scope.networkId}`,
        )
        this.name = 'InvalidCaip19Error'
        this.caip19 = caip19
    }
}

const CAIP19_PATTERN = /^eip155:(\d+)\/(erc20|slip44):([^/]+)$/

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

/** The backend's id for an app asset id; ERC-20 addresses go out lowercase. */
export const toCaip19 = (
    assetId: string,
    scope: ChainScope,
    chain: EvmChain,
): string => {
    const chainId = eip155ChainIdOf(scope, chain)
    if (assetId === chain.nativeAsset.assetId)
        return `eip155:${chainId}/slip44:${chain.row.nativeAsset.slip44}`
    return `eip155:${chainId}/erc20:${getAddress(assetId).toLowerCase()}`
}

/** The app asset id (checksummed address, or the native id) for a backend id on the scope's chain. */
export const fromCaip19 = (
    caip19: string,
    scope: ChainScope,
    chain: EvmChain,
): string => {
    const chainId = eip155ChainIdOf(scope, chain)
    const [, idChain, namespace, reference] = CAIP19_PATTERN.exec(caip19) ?? []
    if (idChain === String(chainId)) {
        if (
            namespace === 'slip44' &&
            reference === chain.row.nativeAsset.slip44
        ) {
            return chain.nativeAsset.assetId
        }
        if (namespace === 'erc20' && reference && isAddress(reference)) {
            return getAddress(reference)
        }
    }
    throw new InvalidCaip19Error(caip19, scope)
}
