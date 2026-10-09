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

import { CHAIN_IDS, type ChainId } from '@perawallet/wallet-core-chain-contract'
import type { DeviceAccountRegistration } from '@perawallet/wallet-core-device'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters } from './chain-adapter'
import { chainAccountOf } from './credentials/accessors'
import type { WalletAccount } from './models'

const registersOn = (chainId: ChainId): boolean => {
    const { chains } = getProvider()
    return (
        accountsChainAdapters.has(chainId) &&
        !!accountsChainAdapters.get(chainId).deviceAccountType &&
        chains.has(chainId) &&
        chains.capabilities(chainId).notifications
    )
}

/**
 * Project the wallet's accounts onto the registration payload: each account's
 * address on every chain that registers devices. Notification state is
 * passed in rather than read from a store so callers can register the
 * *result* of a pending toggle without waiting for the store write to
 * propagate through React.
 */
export const buildDeviceAccountRegistrations = (
    accounts: WalletAccount[],
    disabledAddresses: readonly string[],
): DeviceAccountRegistration[] => {
    const disabled = new Set(disabledAddresses)
    const chainIds = CHAIN_IDS.filter(registersOn)
    return accounts.flatMap(account =>
        chainIds.flatMap(chainId => {
            const address = chainAccountOf(account, chainId)?.address
            if (address === undefined) return []
            const adapter = accountsChainAdapters.get(chainId)
            const accountType = adapter.deviceAccountType?.(account) ?? null
            if (accountType === null) return []
            return [
                {
                    address,
                    accountType,
                    rank: adapter.duplicateRank(account),
                    receiveNotifications: !disabled.has(address),
                },
            ]
        }),
    )
}
