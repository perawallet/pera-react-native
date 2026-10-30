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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    DeviceAccountRegistration,
    DeviceRegistration,
    DeviceRegistrationRequest,
    V3DeviceRegistrationRequest,
} from '../models'

const MAX_CURRENCY_LENGTH = 8

/**
 * Collapse an address repeated on one chain, the higher-ranked registration
 * winning and equal ranks keeping the last occurrence — the backend dedupes
 * last-wins, so ties resolve the way it would. Sending a clean array keeps the
 * request auditable and removes the dependency on that behaviour.
 */
const dedupeByChainAddress = (
    accounts: DeviceAccountRegistration[],
): DeviceAccountRegistration[] => {
    const byChainAddress = new Map<string, DeviceAccountRegistration>()
    for (const account of accounts) {
        const key = `${account.chainId}|${account.address}`
        const incumbent = byChainAddress.get(key)
        if (incumbent === undefined || account.rank >= incumbent.rank) {
            byChainAddress.set(key, account)
        }
    }
    return [...byChainAddress.values()]
}

/**
 * `chainOf` gives the CAIP-2 id of a chain on the deployment the request goes
 * to; an account on a chain it can't name is left out rather than refused.
 */
export const toDeviceRegistrationRequest = (
    registration: DeviceRegistration,
    chainOf: (chainId: ChainId) => Nullable<string>,
): DeviceRegistrationRequest => ({
    ...(registration.id !== undefined ? { id: registration.id } : {}),
    push_token: registration.pushToken,
    platform: registration.platform,
    locale: registration.locale,
    app_version: registration.appVersion,
    // Omitted rather than truncated: the backend stores what it is sent and
    // marks the choice explicit, so a sliced code would stick as a currency
    // that never existed. Dropping it leaves the column null and falls back.
    ...(registration.currency &&
    registration.currency.length <= MAX_CURRENCY_LENGTH
        ? { currency: registration.currency }
        : {}),
    accounts: dedupeByChainAddress(registration.accounts).flatMap(account => {
        const chain = chainOf(account.chainId)
        if (chain === null) return []
        return [
            {
                address: account.address,
                chain,
                account_type: account.accountType,
                receive_notifications: account.receiveNotifications,
            },
        ]
    }),
})

export const toV3DeviceRegistrationRequest = (
    registration: DeviceRegistration,
    isOnV3: (chainId: ChainId) => boolean,
): V3DeviceRegistrationRequest => {
    const { accounts, ...device } = toDeviceRegistrationRequest(
        registration,
        chainId => (isOnV3(chainId) ? chainId : null),
    )
    return {
        ...device,
        accounts: accounts.map(account => ({
            address: account.address,
            account_type: account.account_type,
            receive_notifications: account.receive_notifications,
        })),
    }
}
