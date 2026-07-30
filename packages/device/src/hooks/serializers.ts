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

import type {
    DeviceAccountRegistration,
    DeviceAccountType,
    DeviceRegistration,
    DeviceRegistrationRequest,
} from '../models'

/**
 * Precedence for resolving two registrations of the same address: higher wins.
 * If an address is ever held both as a watch account and as a signing account,
 * the signing type is the one the backend must be told about — registering
 * `watch` for what is really a quantum account makes it price that account's
 * swap quotes at the Ed25519 minimum fee and the chain rejects the swap.
 *
 * `satisfies` keeps this exhaustive: adding or renaming a `DeviceAccountType`
 * breaks the build here instead of silently ranking it `undefined`.
 *
 * This is the wire-boundary copy of `ACCOUNT_TYPE_RANK` in
 * `packages/accounts/src/store/store.ts`, which resolves the same collision
 * over the internal `AccountType` enum before registration ever sees it. The
 * two enums are deliberately separate declarations (see the comment on
 * `DEVICE_ACCOUNT_TYPE_BY_ACCOUNT_TYPE` in
 * `packages/accounts/src/device-accounts.ts`), so the orders must be kept in
 * sync by hand — update both together.
 */
const DEVICE_ACCOUNT_TYPE_RANK = {
    quantum: 6,
    hardware: 5,
    hdWallet: 4,
    algo25: 3,
    multisig: 2,
    watch: 1,
} satisfies Record<DeviceAccountType, number>

/**
 * Collapse repeated addresses, the higher-precedence account type winning and
 * equal ranks keeping the last occurrence — v3 specifies last-wins
 * server-side, so ties resolve the way the backend would. Sending a clean
 * array keeps the request auditable and removes the dependency on that
 * behaviour.
 */
const dedupeByAddress = (
    accounts: DeviceAccountRegistration[],
): DeviceAccountRegistration[] => {
    const byAddress = new Map<string, DeviceAccountRegistration>()
    for (const account of accounts) {
        const incumbent = byAddress.get(account.address)
        if (
            incumbent === undefined ||
            DEVICE_ACCOUNT_TYPE_RANK[account.accountType] >=
                DEVICE_ACCOUNT_TYPE_RANK[incumbent.accountType]
        ) {
            byAddress.set(account.address, account)
        }
    }
    return [...byAddress.values()]
}

export const toDeviceRegistrationRequest = (
    registration: DeviceRegistration,
): DeviceRegistrationRequest => ({
    ...(registration.id !== undefined ? { id: registration.id } : {}),
    push_token: registration.pushToken,
    platform: registration.platform,
    locale: registration.locale,
    app_version: registration.appVersion,
    accounts: dedupeByAddress(registration.accounts).map(account => ({
        address: account.address,
        account_type: account.accountType,
        receive_notifications: account.receiveNotifications,
    })),
})
