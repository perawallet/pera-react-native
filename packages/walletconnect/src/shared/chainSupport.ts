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

import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '@perawallet/wallet-core-connections/dappRequest'
import {
    Networks,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/** Shared by v1 and v2 (`pera/no-cross-protocol-imports` forbids them importing each other). */
export type WalletConnectSupport = DappRequestChainAdapter['walletConnect']

/**
 * `null` when no chain adapter is registered for the chain `network` belongs
 * to. Every network resolves to one chain package, which owns the whole
 * `walletConnect` member; a version speaking to it never needs to know which
 * chain it reached.
 */
export const walletConnectSupportFor = (
    network: Network,
): Nullable<WalletConnectSupport> => {
    const { chainId } = scopeForLegacyNetwork(network)
    return dappRequestChainAdapters.has(chainId)
        ? dappRequestChainAdapters.get(chainId).walletConnect
        : null
}

/** Fails closed: no adapter, or a chain that serves no v1, accepts nothing. */
export const isV1ChainIdAcceptable = (
    chainId: number | undefined,
    network: Network,
): boolean => {
    const support = walletConnectSupportFor(network)
    if (!support?.v1) return false
    return support.v1.isChainIdAcceptable(chainId, network)
}

/**
 * Fails closed to `[]`. `Networks.mainnet` is only the anchor used to look up
 * the registered adapter — every legacy network belongs to the same chain
 * today, so any of them would resolve to the same instance — the returned
 * networks are the adapter's own answer for `chainId`.
 */
export const v1NetworksFor = (chainId: number): Network[] => {
    const support = walletConnectSupportFor(Networks.mainnet)
    if (!support?.v1) return []
    return support.v1.networksFor(chainId) as Network[]
}
