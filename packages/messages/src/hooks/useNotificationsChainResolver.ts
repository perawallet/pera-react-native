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
    useRegisteredChainIds,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from '@perawallet/wallet-core-chain-shared'
import { isSentInDeviceRegistration } from '@perawallet/wallet-core-device'
import type { Optional } from '@perawallet/wallet-core-shared'

/**
 * The first held chain, in registry order, whose address device registration
 * sends, else `undefined`. Not the own chain: an account found active only on
 * Ethereum still has its Algorand address registered under the v3 API. Not the `notifications` capability: registration ignores
 * it, so an address registered while it is off (by default or at runtime) can
 * still be pushed to and keeps its mute control.
 */
export const useNotificationsChainResolver = (): ((
    account: WalletAccount,
) => Optional<ChainId>) => {
    const registeredChainIds = useRegisteredChainIds()
    const deployment = useWalletDeployment()
    return useCallback(
        (account: WalletAccount) => {
            return registeredChainIds.find(chainId =>
                isSentInDeviceRegistration(account, chainId, deployment),
            )
        },
        [registeredChainIds, deployment],
    )
}
