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
    identifyUSBProductId,
} from '@ledgerhq/devices'
import { StatusCodes } from '@ledgerhq/errors'
import type { HardwareWalletAppVersion } from '@perawallet/wallet-extension-hardware-wallet'
import type { LedgerDeviceModel } from './types'
import type { Nullable, Maybe } from '@perawallet/wallet-core-shared'

/** @ledgerhq/devices model IDs -> our user-facing names. */
const DEVICE_MODEL_MAP: Partial<Record<DeviceModelId, LedgerDeviceModel>> = {
    [DeviceModelId.nanoS]: 'nanoS',
    [DeviceModelId.nanoSP]: 'nanoSPlus',
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

/** Shown in place of a model for an unrecognized USB product ID. */
export const UNKNOWN_USB_LEDGER_MODEL = 'ledger'

// Ledger encodes the model in the product id's high byte and the USB interface
// mix in the low byte (0x4011, 0x4015 are both a Nano X), so exact-id lookup
// misses most devices; `identifyUSBProductId` handles both schemes.
export const resolveUsbDeviceModel = (
    productId: Maybe<number>,
): LedgerDeviceModel | typeof UNKNOWN_USB_LEDGER_MODEL => {
    if (typeof productId !== 'number') return UNKNOWN_USB_LEDGER_MODEL
    const deviceModel = identifyUSBProductId(productId)
    return (
        (deviceModel && DEVICE_MODEL_MAP[deviceModel.id]) ??
        UNKNOWN_USB_LEDGER_MODEL
    )
}

// Product names are trademarks, so they stay untranslated like the BLE
// advertised name does.
const LEDGER_PRODUCT_NAMES: Record<LedgerDeviceModel, string> = {
    nanoS: 'Ledger Nano S',
    nanoSPlus: 'Ledger Nano S Plus',
    nanoX: 'Ledger Nano X',
    stax: 'Ledger Stax',
    flex: 'Ledger Flex',
    nanoGen5: 'Ledger Nano Gen5',
}

export const UNKNOWN_USB_LEDGER_NAME = 'Ledger (USB)'

export const usbLedgerDisplayName = (
    model: LedgerDeviceModel | typeof UNKNOWN_USB_LEDGER_MODEL,
): string =>
    model === UNKNOWN_USB_LEDGER_MODEL
        ? UNKNOWN_USB_LEDGER_NAME
        : LEDGER_PRODUCT_NAMES[model]

/**
 * Standard codes from @ledgerhq/errors. An app's own non-standard codes belong
 * to its driver, via `LedgerAppProfile`.
 */
export const LEDGER_STATUS_CODES = {
    SUCCESS: StatusCodes.OK,
    USER_REJECTED: StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED,
    APP_NOT_OPEN: StatusCodes.CLA_NOT_SUPPORTED,
    LOCKED_DEVICE: StatusCodes.LOCKED_DEVICE,
    /**
     * The app understood the CLA but not the instruction — the installed app
     * predates the feature being invoked. This is the only version signal the
     * device volunteers, so it stands in for a firmware / app-version check we
     * cannot otherwise perform.
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
 * scrolling a multi-screen arbitrary-data payload easily exceeds 30s, and cutting that
 * off tears down the signing sheet while the device is still prompting.
 */
export const LEDGER_CONFIRMATION_TIMEOUT_MS = 300_000

/**
 * Matches native iOS's BLE-connect timeout and covers Android first-pair
 * latency (~5-15s for the OS scan + ATT handshake on a cold cache). 10s
 * reproducibly fired mid-pairing, leaving the user with no UI.
 */
export const LEDGER_CONNECTION_TIMEOUT_MS = 20_000

export const isAppVersionAtLeast = (
    actual: HardwareWalletAppVersion,
    required: HardwareWalletAppVersion,
): boolean => {
    if (actual.major !== required.major) return actual.major > required.major
    if (actual.minor !== required.minor) return actual.minor > required.minor
    return actual.patch >= required.patch
}
