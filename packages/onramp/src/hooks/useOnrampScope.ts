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

import { useMemo } from 'react'
import type { ChainId, ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useChainCapabilityCheck,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { rampChainAdapters } from '../chain-adapter'

/** The chains an account exists on; an account's `chains` map fits. */
export type AccountChainMap = Partial<Record<ChainId, unknown>>

/**
 * The chain Fund buys onto for an account: the first, in chain-registry
 * order, that the account exists on, has `onramp` and has a ramp adapter.
 */
export const onrampChainIdOf = (
    accountChains: AccountChainMap,
    hasOnramp: (chainId: ChainId) => boolean,
): Nullable<ChainId> =>
    getProvider()
        .chains.list()
        .map(descriptor => descriptor.id)
        .find(
            chainId =>
                accountChains[chainId] !== undefined &&
                rampChainAdapters.has(chainId) &&
                hasOnramp(chainId),
        ) ?? null

export const useOnrampChainOf = (): ((
    accountChains: AccountChainMap,
) => Nullable<ChainId>) => {
    const check = useChainCapabilityCheck()
    return accountChains =>
        onrampChainIdOf(accountChains, chainId =>
            check({ chain: { chainId, capability: 'onramp' } }),
        )
}

export const useOnrampScope = (
    accountChains: Nullable<AccountChainMap>,
): Nullable<ChainScope> => {
    const chainOf = useOnrampChainOf()
    const chainId = accountChains === null ? null : chainOf(accountChains)
    const networkId = useNetworkStore(state =>
        chainId === null ? null : selectChainNetworkId(state, chainId),
    )
    return useMemo(
        () =>
            chainId === null || networkId === null
                ? null
                : { chainId, networkId },
        [chainId, networkId],
    )
}
