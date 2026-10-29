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

import { useCallback, useMemo } from 'react'
import type {
    ChainCapability,
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useChainCapabilityCheck,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainAccountOf } from '../credentials/accessors'
import type { WalletAccount } from '../models'

/**
 * Resolves the chain an account uses for `capability`: the first registered
 * chain, in registry order, that the account is on and that has it switched on.
 */
export const useCapabilityChainResolver = (
    capability: ChainCapability,
): ((account: WalletAccount) => Optional<ChainId>) => {
    const check = useChainCapabilityCheck()
    // Joined so the resolver keeps its identity until the enabled set changes.
    const enabledKey = getProvider()
        .chains.list()
        .map(({ id }) => id)
        .filter(chainId => check({ chain: { chainId, capability } }))
        .join()
    return useCallback(
        (account: WalletAccount) => {
            const enabled = enabledKey
                ? (enabledKey.split(',') as ChainId[])
                : []
            return enabled.find(
                chainId => chainAccountOf(account, chainId) !== undefined,
            )
        },
        [enabledKey],
    )
}

/**
 * The account's chain for `capability` at that chain's selected network; null when it has none.
 * `chainId` pins the resolution to that chain; it never falls back to another.
 */
export const useAccountCapabilityScope = (
    account: Nullable<WalletAccount>,
    capability: ChainCapability,
    chainId?: ChainId,
): Nullable<ChainScope> => {
    const chainOf = useCapabilityChainResolver(capability)
    const check = useChainCapabilityCheck()
    const resolvePinned = (owner: WalletAccount, pinned: ChainId) =>
        getProvider().chains.has(pinned) &&
        check({ chain: { chainId: pinned, capability } }) &&
        chainAccountOf(owner, pinned) !== undefined
            ? pinned
            : undefined
    const resolvedChainIdOf = () => {
        if (!account) return undefined
        if (chainId === undefined) return chainOf(account)
        return resolvePinned(account, chainId)
    }
    const resolvedChainId = resolvedChainIdOf()
    const networkId = useNetworkStore(state =>
        resolvedChainId === undefined
            ? undefined
            : selectChainNetworkId(state, resolvedChainId),
    )
    return useMemo(
        () =>
            resolvedChainId === undefined || networkId === undefined
                ? null
                : { chainId: resolvedChainId, networkId },
        [resolvedChainId, networkId],
    )
}
