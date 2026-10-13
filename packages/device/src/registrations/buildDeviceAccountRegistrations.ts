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

import { CHAIN_IDS } from '@perawallet/wallet-core-chain-contract'
import type { DeviceAccountRegistration } from '../models'
import {
    deviceChainAdapters,
    type DeviceRegistrableAccount,
} from './chain-adapter'

/**
 * Project the wallet's accounts onto the registration payload: each account's
 * address on every chain with a device adapter. Notification state is passed
 * in rather than read from a store so callers can register the *result* of a
 * pending toggle without waiting for the store write to propagate through
 * React.
 */
export const buildDeviceAccountRegistrations = (
    accounts: readonly DeviceRegistrableAccount[],
    disabledAddresses: readonly string[],
): DeviceAccountRegistration[] => {
    const disabled = new Set(disabledAddresses)
    const adapters = CHAIN_IDS.filter(chainId =>
        deviceChainAdapters.has(chainId),
    ).map(chainId => deviceChainAdapters.get(chainId))
    return accounts.flatMap(account =>
        adapters.flatMap(adapter => {
            const address = account.chains[adapter.chainId]?.address
            if (address === undefined) return []
            const accountType = adapter.accountTypeOf(account)
            if (accountType === null) return []
            return [
                {
                    address,
                    accountType,
                    rank: adapter.rankOf(account),
                    receiveNotifications: !disabled.has(address),
                },
            ]
        }),
    )
}
