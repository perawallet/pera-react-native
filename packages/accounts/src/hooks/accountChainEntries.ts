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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainAccountOf } from '../credentials/accessors'
import type { WalletAccount } from '../models'

export type AccountChainEntry = {
    chainId: ChainId
    address: string
    /** On the caller's chain, whose native asset its native totals are in. */
    isHome: boolean
}

/**
 * Registered chains in registry order. Re-read every render, since the registry
 * can change under a mounted hook; the result keeps its identity until the set
 * of chains does, so memos keyed on it hold.
 */
export const useRegisteredChainIds = (): ChainId[] => {
    const key = getProvider()
        .chains.list()
        .map(({ id }) => id)
        .join()
    return useMemo(() => (key ? (key.split(',') as ChainId[]) : []), [key])
}

/** Registered chains other than `homeChainId`, in registry order. */
export const useOtherRegisteredChainIds = (homeChainId: ChainId): ChainId[] => {
    const registered = useRegisteredChainIds()
    return useMemo(
        () => registered.filter(chainId => chainId !== homeChainId),
        [registered, homeChainId],
    )
}

/**
 * Every address the account holds on `homeChainId` or another registered
 * chain, home first. A record is created on one chain and gains an entry for
 * each chain enabled on it later, so this can hold several.
 */
export const accountChainEntries = (
    account: WalletAccount,
    homeChainId: ChainId,
    otherChainIds: readonly ChainId[],
): AccountChainEntry[] => {
    const home = chainAccountOf(account, homeChainId)?.address
    return [
        ...(home
            ? [{ chainId: homeChainId, address: home, isHome: true }]
            : []),
        ...otherChainIds.flatMap(chainId => {
            const address = chainAccountOf(account, chainId)?.address
            return address ? [{ chainId, address, isHome: false }] : []
        }),
    ]
}
