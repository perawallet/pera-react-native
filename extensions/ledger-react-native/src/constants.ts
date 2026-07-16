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

import {
    DeviceModelId,
    getBluetoothServiceUuids,
    getInfosForServiceUuid,
} from '@ledgerhq/devices'
import { StatusCodes } from '@ledgerhq/errors'
import type { HardwareWalletAppVersion } from '@perawallet/wallet-core-hardware-wallet'
import type { LedgerDeviceModel } from './types'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Maps @ledgerhq/devices model IDs to our user-friendly LedgerDeviceModel names.
 */
const DEVICE_MODEL_MAP: Partial<Record<DeviceModelId, LedgerDeviceModel>> = {
    [DeviceModelId.nanoX]: 'nanoX',
    [DeviceModelId.stax]: 'stax',
    [DeviceModelId.europa]: 'flex',
    [DeviceModelId.apex]: 'nanoGen5',
}

/**
 * All BLE service UUIDs for Ledger devices, sourced from @ledgerhq/devices.
 */
export const LEDGER_BLE_SERVICE_UUIDS: string[] = getBluetoothServiceUuids()

/**
 * Resolve a BLE service UUID to our LedgerDeviceModel.
 * Returns 'nanoX' as the default if the UUID is unrecognized.
 */
export const resolveDeviceModel = (
    serviceUUIDs: Nullable<string[]>,
): LedgerDeviceModel => {
    if (!serviceUUIDs) return 'nanoX'

    for (const uuid of serviceUUIDs) {
        const infos = getInfosForServiceUuid(uuid.toLowerCase())
        if (infos) {
            return (
                DEVICE_MODEL_MAP[infos.deviceModel.id as DeviceModelId] ??
                'nanoX'
            )
        }
    }

    return 'nanoX'
}

/**
 * BIP-44 derivation path prefix for Algorand on Ledger.
 * Full path: 44'/283'/{accountIndex}'/0/0
 * The Ledger device handles derivation internally — the app only sends the path string.
 */
export const ALGORAND_BIP44_PREFIX = "44'/283'"

/**
 * Construct the full BIP-32 derivation path for a Ledger Algorand account,
 * in the canonical `m/`-prefixed form (e.g. `m/44'/283'/0'/0/0`).
 *
 * The `m/` prefix is required by `@algorandfoundation/ledger-algorand-js`'s
 * `serializePath` (used by `signData`); it rejects bare `44'/283'/…` paths
 * with "Path should start with \"m/\"".
 */
export const buildLedgerAccountPath = (accountIndex: number): string =>
    `m/${ALGORAND_BIP44_PREFIX}/${accountIndex}'/0/0`

/**
 * APDU status codes used to classify Ledger responses.
 *
 * Standard codes are sourced from @ledgerhq/errors. The Algorand app also
 * returns a non-standard 0x6986 when the user rejects on firmware >= 2.0.7.
 */
export const LEDGER_STATUS_CODES = {
    SUCCESS: StatusCodes.OK,
    /** User rejected the operation on the device (v2.0.7+, Algorand app-specific) */
    USER_REJECTED: 0x69_86,
    USER_REJECTED_LEGACY: StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED,
    APP_NOT_OPEN: StatusCodes.CLA_NOT_SUPPORTED,
    /** Device is locked (PIN screen) — the user must unlock and retry. */
    LOCKED_DEVICE: StatusCodes.LOCKED_DEVICE,
} as const

/**
 * Ledger timeouts and tuning parameters.
 *
 * These are compile-time constants chosen to match the native iOS/Android
 * clients and the Ledger firmware's own timing envelope. Moving them to
 * remote config was considered but deferred: they are safety-sensitive
 * (too-short values strand users mid-sign; too-long values hang the UI
 * on a dead BLE link) and changing them doesn't benefit from per-release
 * overrides. If a production incident ever needs a hotfix here, promote
 * them to `RemoteConfigKeys` with the current values as defaults — the
 * hooks/pipeline call sites are small enough to rewire.
 */

/** Maximum time to scan for Ledger devices (BLE or USB) before showing a timeout message. */
export const LEDGER_SCAN_TIMEOUT_MS = 30_000

/**
 * Maximum time to wait for the user to review and confirm on the Ledger
 * device. This is a backstop against a silently-dropped BLE link mid-sign —
 * NOT a bound on the user's reading time. It must comfortably exceed how long
 * a person spends reviewing a transaction or ARC-60 data payload on-device
 * (scrolling a multi-screen message can easily exceed 30s), otherwise the
 * sign call is aborted and the signing sheet tears down while the device is
 * still prompting. 5 minutes is generous enough to never cut off a genuine
 * review while still bounding a dead link.
 */
export const LEDGER_CONFIRMATION_TIMEOUT_MS = 300_000

/**
 * Maximum time to wait for a BLE connection to the Ledger device.
 *
 * 20 seconds matches the native iOS BLE-connect timeout in
 * `TransactionController.swift` and covers the first-pair latency seen on
 * Android (~5-15s for the OS-level scan + ATT handshake when the device is
 * not in cache). A previous value of 10s reproducibly fired before the
 * device finished pairing on cold-start, leaving the user with no UI.
 */
export const LEDGER_CONNECTION_TIMEOUT_MS = 20_000

/**
 * Stop scanning for accounts after this many consecutive indices
 * return addresses with no on-chain presence.
 */
export const MAX_ACCOUNT_SCAN_GAP = 2

/**
 * Minimum Ledger Algorand app version that ships the SIGN_ARBITRARY (0x10)
 * instruction required for ARC-60 arbitrary-data signing.
 *
 * NOTE: Confirm the exact version against the Ledger Algorand app changelog
 * and a physical-device check before release; adjust if the device reports a
 * different first-supporting version. The early gate is a UX nicety — the
 * on-device error fallback (mapped to `app_outdated`) is the backstop if this
 * value is too low.
 */
export const MIN_ARBITRARY_SIGN_APP_VERSION: HardwareWalletAppVersion = {
    major: 2,
    minor: 0,
    patch: 0,
}

/**
 * Returns true when `actual` is greater than or equal to `required`
 * (semantic major.minor.patch comparison).
 */
export const isAppVersionAtLeast = (
    actual: HardwareWalletAppVersion,
    required: HardwareWalletAppVersion,
): boolean => {
    if (actual.major !== required.major) return actual.major > required.major
    if (actual.minor !== required.minor) return actual.minor > required.minor
    return actual.patch >= required.patch
}
