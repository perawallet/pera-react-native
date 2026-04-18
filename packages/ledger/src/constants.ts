/*
 Copyright 2022-2025 Pera Wallet, LDA
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
 * Construct the full BIP-44 path for a Ledger Algorand account.
 */
export const buildLedgerAccountPath = (accountIndex: number): string =>
    `${ALGORAND_BIP44_PREFIX}/${accountIndex}'/0/0`

/**
 * APDU status codes used to classify Ledger responses.
 *
 * Standard codes are sourced from @ledgerhq/errors. The Algorand app also
 * returns a non-standard 0x6986 when the user rejects on firmware >= 2.0.7.
 */
export const LEDGER_STATUS_CODES = {
    SUCCESS: StatusCodes.OK,
    /** User rejected the operation on the device (v2.0.7+, Algorand app-specific) */
    USER_REJECTED: 0x6986,
    USER_REJECTED_LEGACY: StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED,
    APP_NOT_OPEN: StatusCodes.CLA_NOT_SUPPORTED,
} as const

/**
 * Maximum time to scan for BLE devices before showing a timeout message.
 */
export const LEDGER_SCAN_TIMEOUT_MS = 30_000

/**
 * Maximum time to wait for user confirmation on the Ledger device.
 */
export const LEDGER_CONFIRMATION_TIMEOUT_MS = 30_000

/**
 * Stop scanning for accounts after this many consecutive indices
 * return addresses with no on-chain presence.
 */
export const MAX_ACCOUNT_SCAN_GAP = 2
