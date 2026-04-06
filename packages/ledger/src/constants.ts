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

import type { LedgerDeviceModel } from './types'

/**
 * BLE service UUIDs for each Ledger device model.
 * Used to identify device model during BLE scanning.
 */
export const LEDGER_SERVICE_UUIDS: Record<LedgerDeviceModel, string> = {
    nanoX: '13d63400-2c97-0004-0000-4c6564676572',
    stax: '13d63400-2c97-6004-0000-4c6564676572',
    flex: '13d63400-2c97-3004-0000-4c6564676572',
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
 * APDU status codes returned by the Ledger Algorand app.
 */
export const LEDGER_STATUS_CODES = {
    /** Operation succeeded */
    SUCCESS: 0x9000,
    /** User rejected the operation on the device (v2.0.7+) */
    USER_REJECTED: 0x6986,
    /** User rejected the operation on the device (pre v2.0.7) */
    USER_REJECTED_LEGACY: 0x6985,
    /** The Algorand app is not open on the device */
    APP_NOT_OPEN: 0x6e00,
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
export const MAX_ACCOUNT_SCAN_GAP = 1
