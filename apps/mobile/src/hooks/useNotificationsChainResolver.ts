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
import {
    accountChainIdOf,
    useRegisteredChainIds,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useChainCapabilityCheck } from '@perawallet/wallet-core-chain-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

/**
 * The account's own chain when that chain can notify it, else `undefined`.
 * The build layer counts as well as the live value: a runtime switch-off
 * doesn't stop pushes already registered, so the mute row and list entry stay.
 * Keeps its identity until the set of registered chains, or of those that can
 * notify, changes.
 */
export const useNotificationsChainResolver = (): ((
    account: WalletAccount,
) => ChainId | undefined) => {
    const check = useChainCapabilityCheck()
    const { chains } = getProvider()
    const registeredChainIds = useRegisteredChainIds()
    // Joined so the set below keeps its identity until the notifying chains change.
    const notifyingKey = registeredChainIds
        .filter(
            chainId =>
                check({ chain: { chainId, capability: 'notifications' } }) ||
                chains.isInBuild(chainId, 'notifications'),
        )
        .join()
    const notifyingChainIds = useMemo(
        () =>
            new Set<ChainId>(
                notifyingKey ? (notifyingKey.split(',') as ChainId[]) : [],
            ),
        [notifyingKey],
    )

    return useCallback(
        (account: WalletAccount) => {
            const chainId = accountChainIdOf(account, registeredChainIds)
            return notifyingChainIds.has(chainId) ? chainId : undefined
        },
        [registeredChainIds, notifyingChainIds],
    )
}
