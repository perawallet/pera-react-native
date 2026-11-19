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

import { useCallback } from 'react'
import {
    accountChainIdOf,
    chainAccountOf,
    useRegisteredChainIds,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import {
    isSentInDeviceRegistration,
    usePeraScopeRefusalsVersion,
} from '@perawallet/wallet-core-device'
import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * The chain whose address an account's notification mute acts on: the own
 * chain when device registration sends it, else the first held chain, in
 * registry order, that it sends. Under the v3 API only Algorand is sent, so an
 * account found active only on Ethereum falls back to its Algorand address.
 * Not the `notifications` capability: registration ignores it, so an address
 * registered while it is off can still be pushed to and keeps its mute control.
 */
export const useNotificationsChainResolver = (): ((
    account: WalletAccount,
) => Optional<ChainId>) => {
    const registeredChainIds = useRegisteredChainIds()
    const deployment = useWalletDeployment()
    const refusalsVersion = usePeraScopeRefusalsVersion()
    return useCallback(
        (account: WalletAccount) =>
            [
                accountChainIdOf(account, registeredChainIds),
                ...registeredChainIds,
            ].find(chainId =>
                isSentInDeviceRegistration(account, chainId, deployment),
            ),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refusalsVersion is an identity key: a refusal changes what isSentInDeviceRegistration answers
        [registeredChainIds, deployment, refusalsVersion],
    )
}

/** The address an account's notification mute reads and writes; `undefined` when registration sends none. */
export const useNotificationsAddressResolver = (): ((
    account: WalletAccount,
) => Optional<string>) => {
    const notificationsChainOf = useNotificationsChainResolver()
    return useCallback(
        (account: WalletAccount) => {
            const chainId = notificationsChainOf(account)
            return chainId === undefined
                ? undefined
                : chainAccountOf(account, chainId)?.address
        },
        [notificationsChainOf],
    )
}
