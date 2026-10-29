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
    ChainId,
    ChainScopeKey,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'
import type { DevicePlatform } from '@perawallet/wallet-extension-platform'

/** One account as registration reports it. Domain shape, camelCase. */
export type DeviceAccountRegistration = {
    /** Resolved to the wire `chain` only when sent, for the deployment it goes to. */
    chainId: ChainId
    address: string
    /** The devices API `account_type`, as the account's chain spells it. */
    accountType: string
    /**
     * Which of two registrations of one address the backend is told about:
     * higher wins. Registering `watch` for what is really a signing account
     * makes the backend price it as the wrong kind.
     */
    rank: number
    receiveNotifications: boolean
}

/**
 * Version-neutral registration payload. Every consumer above the endpoint
 * layer speaks this; only `serializers.ts` knows the wire shape.
 *
 * `pushToken` is a required string, not an optional one: the API has no
 * "omit to keep the stored value" path, and `''` clears the token.
 */
export type DeviceRegistration = {
    /** Omit to create a device; supply to update THIS device. */
    id?: string
    pushToken: string
    platform: DevicePlatform
    locale: string
    appVersion: string
    /**
     * The user's fiat display-currency id, exactly as `/v1/currencies/`
     * returns it ('USD', 'TRY'). The backend renders push copy and notification
     * text in it, and falls back to USD for a device that never sent one.
     * Independent of `locale`.
     */
    currency?: string
    accounts: DeviceAccountRegistration[]
}

export type DeviceAccountRequest = {
    address: string
    /** CAIP-2 id of the network the address is followed on. */
    chain: string
    account_type: string
    receive_notifications: boolean
}

export type DeviceRegistrationRequest = {
    id?: string
    push_token: string
    platform: DevicePlatform
    locale: string
    app_version: string
    /** Max 8 characters; over-length 422s the whole registration. */
    currency?: string
    accounts: DeviceAccountRequest[]
}

/** The v3 devices API names no chain, so it only takes the chains it always carried. */
export type V3DeviceAccountRequest = Omit<DeviceAccountRequest, 'chain'>

export type V3DeviceRegistrationRequest = Omit<
    DeviceRegistrationRequest,
    'accounts'
> & { accounts: V3DeviceAccountRequest[] }

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
 * Provenance of a deployment's device id: 'migrated' while the id written by
 * migrateDeviceIdentifiers is still the active one, 'recreated' once the
 * registration recreate-fallback replaced it (device-keyed server state such
 * as Discover favorites is orphaned at that point). Absent = the id never
 * came from migration.
 */
export type DeviceIdOrigin = 'migrated' | 'recreated'

export type DeviceState = BaseStoreState & {
    pushToken: Nullable<string>
    /** Read through `deviceIdForDeployment`; the setters take a deployment. */
    deviceIDs: Map<ChainScopeKey, Nullable<string>>
    /** Deployments whose last registration attempt failed and awaits a retry. */
    pendingRegistrationDeployments: WalletMode[]
    deviceIdOrigins: Partial<Record<ChainScopeKey, DeviceIdOrigin>>
    setPushToken: (token: Nullable<string>) => void
    setDeviceID: (deployment: WalletMode, id: Nullable<string>) => void
    setRegistrationPending: (deployment: WalletMode, isPending: boolean) => void
    setDeviceIdOrigin: (deployment: WalletMode, origin: DeviceIdOrigin) => void
}
