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

import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type { BaseStoreState } from '@perawallet/wallet-core-shared'
import type { DevicePlatform } from '@perawallet/wallet-extension-platform'

/**
 * Account types as the v3 devices API spells them on the wire. Deliberately a
 * separate declaration from `AccountType` in `@perawallet/wallet-core-accounts`
 * even though the literals currently match: this is a backend contract, and an
 * internal rename must break the build at the mapping in
 * `packages/accounts/src/device-accounts.ts` rather than silently start
 * sending an unrecognised `account_type`.
 */
export const DeviceAccountTypes = {
    algo25: 'algo25',
    hdWallet: 'hdWallet',
    hardware: 'hardware',
    multisig: 'multisig',
    watch: 'watch',
    quantum: 'quantum',
} as const

export type DeviceAccountType =
    (typeof DeviceAccountTypes)[keyof typeof DeviceAccountTypes]

/**
 * Precedence for resolving two registrations of the same address: higher wins.
 * If an address is ever held both as a watch account and as a signing account,
 * the signing type is the one the backend must be told about — registering
 * `watch` for what is really a quantum account makes it price that account's
 * swap quotes at the Ed25519 minimum fee and the chain rejects the swap.
 *
 * `as const` is load-bearing: `satisfies Record<K, number>` alone widens every
 * value to `number` and the cross-enum equality assertion that pins this table
 * to its internal counterpart would pass vacuously.
 *
 * This is the wire-boundary copy of `ACCOUNT_TYPE_RANK` in
 * `@perawallet/wallet-core-accounts`, which resolves the same collision over
 * the internal `AccountType` enum before registration ever sees it. The two
 * enums are deliberately separate declarations (see the comment on
 * `DeviceAccountTypes` above), so the orders are held in sync by a type-level
 * assertion in `packages/accounts/src/device-accounts.ts` — update both
 * together.
 */
export const DEVICE_ACCOUNT_TYPE_RANK = {
    quantum: 6,
    hardware: 5,
    hdWallet: 4,
    algo25: 3,
    multisig: 2,
    watch: 1,
} as const satisfies Record<DeviceAccountType, number>

/** One account as registration reports it. Domain shape, camelCase. */
export type DeviceAccountRegistration = {
    address: string
    accountType: DeviceAccountType
    receiveNotifications: boolean
}

/**
 * Version-neutral registration payload. Every consumer above the endpoint
 * layer speaks this; only `serializers.ts` knows the wire shape.
 *
 * `pushToken` is a required string, not an optional one: v3 has no
 * "omit to keep the stored value" path, and `''` clears the token.
 */
export type DeviceRegistration = {
    /** Omit to create a device; supply to update THIS device. */
    id?: string
    pushToken: string
    platform: DevicePlatform
    locale: string
    appVersion: string
    accounts: DeviceAccountRegistration[]
}

export type DeviceAccountRequest = {
    address: string
    account_type: DeviceAccountType
    receive_notifications: boolean
}

export type DeviceRegistrationRequest = {
    id?: string
    push_token: string
    platform: DevicePlatform
    locale: string
    app_version: string
    accounts: DeviceAccountRequest[]
}

/** `id` wins when both identifiers are present; a blank token is rejected. */
export type DeviceDeleteRequest =
    | { id: string }
    | { push_token: string; platform: DevicePlatform }

export type DeviceResponse = {
    id?: string
    push_token?: string
    platform: DevicePlatform
    locale?: string
    app_version?: string
    accounts?: DeviceAccountRequest[]
}

/**
 * Provenance of a network's device id: 'migrated' while the id written by
 * migrateDeviceIdentifiers is still the active one, 'recreated' once the
 * registration recreate-fallback replaced it (device-keyed server state such
 * as Discover favorites is orphaned at that point). Absent = the id never
 * came from migration.
 */
export type DeviceIdOrigin = 'migrated' | 'recreated'

export type DeviceState = BaseStoreState & {
    pushToken: Nullable<string>
    deviceIDs: Map<Network, Nullable<string>>
    /** Networks whose last registration attempt failed and awaits a retry. */
    pendingRegistrationNetworks: Network[]
    deviceIdOrigins: Partial<Record<Network, DeviceIdOrigin>>
    setPushToken: (token: Nullable<string>) => void
    setDeviceID: (network: Network, id: Nullable<string>) => void
    setRegistrationPending: (network: Network, isPending: boolean) => void
    setDeviceIdOrigin: (network: Network, origin: DeviceIdOrigin) => void
}
