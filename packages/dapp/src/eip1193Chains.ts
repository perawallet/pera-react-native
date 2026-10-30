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
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { EIP155_NAMESPACE } from './eip1193Protocol'

/** An EIP-155 chain id as EIP-1193 carries it: lowercase hex, no leading zeros. */
export type Eip155HexChainId = `0x${string}`

const HEX_QUANTITY = /^0x[0-9a-fA-F]+$/

const toHex = (value: bigint): Eip155HexChainId => `0x${value.toString(16)}`

/** The chains whose adapters speak `eip155`, in registration order. */
export const eip155ChainIds = (): ChainId[] =>
    dappRequestChainAdapters
        .list()
        .filter(adapter => adapter.walletConnect.namespace === EIP155_NAMESPACE)
        .map(({ chainId }) => chainId)

/** `null` for a chain that is not eip155, has no adapter, or a network with no CAIP-2 identity. */
export const eip155HexChainIdOf = (
    scope: ChainScope,
): Nullable<Eip155HexChainId> => {
    if (!dappRequestChainAdapters.has(scope.chainId)) return null
    const { walletConnect } = dappRequestChainAdapters.get(scope.chainId)
    if (walletConnect.namespace !== EIP155_NAMESPACE) return null
    const caip2 = walletConnect.caip2ChainIdFor(scope.networkId)
    const reference = caip2?.slice(`${EIP155_NAMESPACE}:`.length)
    if (!caip2?.startsWith(`${EIP155_NAMESPACE}:`) || !reference) return null
    return /^\d+$/.test(reference) ? toHex(BigInt(reference)) : null
}

export const parseEip155HexChainId = (
    value: unknown,
): Nullable<Eip155HexChainId> =>
    typeof value === 'string' && HEX_QUANTITY.test(value)
        ? toHex(BigInt(value))
        : null
