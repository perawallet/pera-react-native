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

/** @ledgerhq/devices model IDs -> our user-facing names. */
const DEVICE_MODEL_MAP: Partial<Record<DeviceModelId, LedgerDeviceModel>> = {
    [DeviceModelId.nanoX]: 'nanoX',
    [DeviceModelId.stax]: 'stax',
    [DeviceModelId.europa]: 'flex',
    [DeviceModelId.apex]: 'nanoGen5',
}

export const LEDGER_BLE_SERVICE_UUIDS: string[] = getBluetoothServiceUuids()

/** Falls back to 'nanoX' for an unrecognized UUID. */
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

/** Full path: 44'/283'/{accountIndex}'/0/0 — the device derives internally. */
export const ALGORAND_BIP44_PREFIX = "44'/283'"

/**
 * The `m/` prefix is mandatory: `ledger-algorand-js`'s `serializePath` rejects
 * bare `44'/283'/…` paths with 'Path should start with "m/"'.
 */
export const buildLedgerAccountPath = (accountIndex: number): string =>
    `m/${ALGORAND_BIP44_PREFIX}/${accountIndex}'/0/0`

/** Standard codes from @ledgerhq/errors, plus the Algorand app's own 0x6986. */
export const LEDGER_STATUS_CODES = {
    SUCCESS: StatusCodes.OK,
    /** Non-standard; Algorand app v2.0.7+. */
    USER_REJECTED: 0x69_86,
    USER_REJECTED_LEGACY: StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED,
    APP_NOT_OPEN: StatusCodes.CLA_NOT_SUPPORTED,
    LOCKED_DEVICE: StatusCodes.LOCKED_DEVICE,
    /**
     * The app understood the CLA but not the instruction — the installed
     * Algorand app predates the feature being invoked. This is the only
     * version signal the device volunteers, so it stands in for a firmware /
     * app-version check we cannot otherwise perform.
     */
    INSTRUCTION_NOT_SUPPORTED: StatusCodes.INS_NOT_SUPPORTED,
} as const

/**
 * The timeouts below are compile-time constants matching the native clients and
 * the firmware's timing envelope. Deliberately not remote config: too short
 * strands users mid-sign, too long hangs the UI on a dead BLE link, and neither
 * benefits from per-release overrides. Promote to `RemoteConfigKeys` if a
 * production incident ever needs a hotfix.
 */

/** Scan for devices (BLE or USB) before showing a timeout message. */
export const LEDGER_SCAN_TIMEOUT_MS = 30_000

/**
 * A backstop against a silently-dropped BLE link, NOT a bound on reading time —
 * scrolling a multi-screen ARC-60 payload easily exceeds 30s, and cutting that
 * off tears down the signing sheet while the device is still prompting.
 */
export const LEDGER_CONFIRMATION_TIMEOUT_MS = 300_000

/**
 * Matches native iOS's BLE-connect timeout and covers Android first-pair
 * latency (~5-15s for the OS scan + ATT handshake on a cold cache). 10s
 * reproducibly fired mid-pairing, leaving the user with no UI.
 */
export const LEDGER_CONNECTION_TIMEOUT_MS = 20_000

/**
 * First app version shipping SIGN_ARBITRARY (0x10), required for ARC-60.
 *
 * NOTE: unverified against the Ledger changelog / a physical device. The gate
 * is a UX nicety — if this is too low, the on-device error fallback (mapped to
 * `app_outdated`) is the backstop.
 */
export const MIN_ARBITRARY_SIGN_APP_VERSION: HardwareWalletAppVersion = {
    major: 2,
    minor: 0,
    patch: 0,
}

export const isAppVersionAtLeast = (
    actual: HardwareWalletAppVersion,
    required: HardwareWalletAppVersion,
): boolean => {
    if (actual.major !== required.major) return actual.major > required.major
    if (actual.minor !== required.minor) return actual.minor > required.minor
    return actual.patch >= required.patch
}
