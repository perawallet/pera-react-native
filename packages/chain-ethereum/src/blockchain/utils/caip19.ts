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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM_CHAIN_ID } from '../../chain-id'
import { ethereumDescriptor } from '../../descriptor'

export class UnknownEvmNetworkError extends Error {
    readonly scope: ChainScope

    constructor(scope: ChainScope) {
        super(`${scope.chainId}/${scope.networkId} is not an Ethereum network`)
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

const NATIVE_ASSET_ID = ethereumDescriptor.nativeAsset.ref.assetId
// SLIP-44 coin type of Ether.
const ETHER_SLIP44 = '60'
const CAIP19_PATTERN = /^eip155:(\d+)\/(erc20|slip44):([^/]+)$/

export const eip155ChainIdOf = (scope: ChainScope): number => {
    const network = ethereumDescriptor.networks.find(
        n => n.id === scope.networkId,
    )
    if (
        scope.chainId !== ETHEREUM_CHAIN_ID ||
        network?.nativeRef.kind !== 'evm'
    ) {
        throw new UnknownEvmNetworkError(scope)
    }
    return network.nativeRef.eip155ChainId
}

/** The backend's id for an app asset id; ERC-20 addresses go out lowercase. */
export const toCaip19 = (assetId: string, scope: ChainScope): string => {
    const chainId = eip155ChainIdOf(scope)
    if (assetId === NATIVE_ASSET_ID)
        return `eip155:${chainId}/slip44:${ETHER_SLIP44}`
    return `eip155:${chainId}/erc20:${getAddress(assetId).toLowerCase()}`
}

/** The app asset id (checksummed address, or the native id) for a backend id on the scope's chain. */
export const fromCaip19 = (caip19: string, scope: ChainScope): string => {
    const chainId = eip155ChainIdOf(scope)
    const [, idChain, namespace, reference] = CAIP19_PATTERN.exec(caip19) ?? []
    if (idChain === String(chainId)) {
        if (namespace === 'slip44' && reference === ETHER_SLIP44) {
            return NATIVE_ASSET_ID
        }
        if (namespace === 'erc20' && reference && isAddress(reference)) {
            return getAddress(reference)
        }
    }
    throw new InvalidCaip19Error(caip19, scope)
}
