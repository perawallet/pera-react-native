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
    AppError,
    ErrorCategory,
    ErrorSeverity,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { LEDGER_STATUS_CODES } from './constants'

export class LedgerConnectionError extends AppError {
    constructor(message: string, originalError?: Error) {
        super(
            `Ledger connection error: ${message}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/** APDU status 0x6e00. */
export class LedgerAppNotOpenError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Algorand app is not open on the Ledger device',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/** APDU status 0x5515. No app-side remediation — the user unlocks and retries. */
export class LedgerDeviceLockedError extends AppError {
    constructor(originalError?: Error) {
        super(
            'The Ledger device is locked',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

export class LedgerUsbNoDeviceError extends AppError {
    constructor(originalError?: Error) {
        super(
            'No Ledger connected over USB',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/**
 * The Android HID layer selects by vendorId alone, so a specific device can't
 * be targeted — the user must disconnect the extras.
 */
export class LedgerUsbMultipleDevicesError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Multiple Ledger devices are connected over USB',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/** APDU status 0x6985/0x6986. */
export class LedgerUserRejectedError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Operation was rejected on the Ledger device',
            {
                severity: ErrorSeverity.LOW,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: false,
            },
            originalError,
        )
        // Pinned as a literal because AppError derives `name` from
        // `constructor.name`, which a minifier can mangle — the swap flow
        // matches this error by name to avoid a value import of this package.
        this.name = 'LedgerUserRejectedError'
    }
}

export class LedgerDisconnectedError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Ledger device disconnected unexpectedly',
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

export class LedgerTimeoutError extends AppError {
    constructor(operation: string, originalError?: Error) {
        super(
            `Ledger operation timed out: ${operation}`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/**
 * Guards against signing with the wrong index when the on-device account order
 * or selected app changed since the account was imported.
 */
export class LedgerAddressMismatchError extends AppError {
    constructor(expected: string, actual: string, originalError?: Error) {
        super(
            `Ledger address mismatch: expected ${expected} but got ${actual}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: false,
                params: { expected, actual },
            },
            originalError,
        )
    }
}

/** Empty signature returned — a protocol/device-state failure, not a rejection. */
export class LedgerSigningError extends AppError {
    constructor(message: string, originalError?: Error) {
        super(
            `Ledger signing error: ${message}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/** No provider registered for the (manufacturer, transportType) tuple. */
export class LedgerProviderNotFoundError extends AppError {
    constructor(reason: string, originalError?: Error) {
        super(
            `Ledger provider not found: ${reason}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: false,
                params: { reason },
            },
            originalError,
        )
    }
}

export class LedgerNoAccountsFoundError extends AppError {
    constructor(originalError?: Error) {
        super(
            'No accounts were found on this Ledger device',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

export class LedgerBluetoothDisabledError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Bluetooth must be enabled to communicate with a Ledger device',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

export class LedgerPermissionDeniedError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Bluetooth scan permission is required to search for nearby Ledger devices',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/**
 * Android <= 11 needs the location services *toggle* on for BLE discovery even
 * when the permission is granted; without it the scan fails with ble-plx 601
 * and surfaces no devices, stranding the user on "Scan Again". Android 12+
 * (`neverForLocation`) is unaffected.
 */
export class LedgerLocationServicesDisabledError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Location services must be enabled to search for nearby Ledger devices',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/**
 * Distinct from `LedgerTimeoutError` so the UI can render scan-specific copy
 * and the troubleshooting link.
 */
export class LedgerScanTimeoutError extends AppError {
    constructor(message: string, originalError?: Error) {
        super(
            `Ledger scan timed out: ${message}`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/** Post-sign processing failed — an encoding failure, not a user action. */
export class LedgerSigningFailedError extends AppError {
    constructor(message: string, originalError?: Error) {
        super(
            `Ledger signing failed: ${message}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

export class LedgerTransmissionError extends AppError {
    constructor(message: string, originalError?: Error) {
        super(
            `Ledger transmission failed: ${message}`,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

export class LedgerPublicKeyReadError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Failed to read public key from Ledger device',
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

/** e.g. the indexer account-existence check. */
export class LedgerNetworkError extends AppError {
    constructor(originalError?: Error) {
        super(
            'Network error during Ledger operation',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}

export class LedgerUnsupportedDeviceError extends AppError {
    constructor(originalError?: Error) {
        super(
            'This Ledger device is not supported',
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: false,
            },
            originalError,
        )
    }
}

/**
 * The device's Algorand app is too old to support arbitrary-data (ARC-60)
 * signing — it lacks the SIGN_ARBITRARY instruction. The user must update
 * the Algorand app via Ledger Live.
 */
export class LedgerAppOutdatedError extends AppError {
    constructor(originalError?: Error) {
        super(
            'The Ledger Algorand app must be updated to sign this request',
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: false,
            },
            originalError,
        )
    }
}

/**
 * Extract the APDU status code from a Ledger SDK error.
 * `@algorandfoundation/ledger-algorand-js` errors expose `returnCode` via
 * `@zondax/ledger-js` `ResponseError`; legacy `statusCode` is also handled for
 * compatibility. Prefer `statusCode` when both are present.
 */
const getStatusCode = (error: unknown): Nullable<number> => {
    if (error === null || typeof error !== 'object') return null
    const record = error as { statusCode?: unknown; returnCode?: unknown }
    if (typeof record.statusCode === 'number') return record.statusCode
    if (typeof record.returnCode === 'number') return record.returnCode
    return null
}

/**
 * `@ledgerhq/react-native-hw-transport-ble` remaps ble-plx failures to an
 * `HwTransportError` before they reach us. The numeric `BleErrorCode` survives
 * both in `.type` (for the codes the lib maps) and appended to the message as
 * `". Origin: <code>"` (for every code) — we read both. Detected by `name` to
 * avoid coupling to the lib's class identity across versions.
 */
const isHwTransportError = (
    error: unknown,
): error is Error & { type?: string } =>
    error instanceof Error && error.name === 'HwTransportError'

/** `react-native-ble-plx` `BleErrorCode` values seen in the remapped message. */
const BLE_ERROR_CODE = {
    BLUETOOTH_POWERED_OFF: 102,
    LOCATION_SERVICES_DISABLED: 601,
} as const

const parseBleOriginCode = (message: string): Nullable<number> => {
    const match = message.match(/Origin:\s*(\d+)\s*$/)
    return match ? Number(match[1]) : null
}

/**
 * `null` for anything unmapped, so the caller falls through to the shared
 * message heuristics rather than flattening every transport error to a
 * generic connection error.
 */
const classifyHwTransportError = (
    error: Error & { type?: string },
): Nullable<AppError> => {
    const originCode = parseBleOriginCode(error.message)

    if (
        error.type === 'LocationServicesDisabled' ||
        originCode === BLE_ERROR_CODE.LOCATION_SERVICES_DISABLED
    ) {
        return new LedgerLocationServicesDisabledError(error)
    }
    // The lib labels a location-*permission* failure
    // `LocationServicesUnauthorized`, so it routes to permission-denied.
    if (error.type === 'LocationServicesUnauthorized') {
        return new LedgerPermissionDeniedError(error)
    }
    if (originCode === BLE_ERROR_CODE.BLUETOOTH_POWERED_OFF) {
        return new LedgerBluetoothDisabledError(error)
    }
    return null
}

/**
 * Pass-through for already-classified AppErrors, so re-classifying at a catch
 * site preserves the specific type — which is also why errors this codebase
 * throws directly need no mapping rule.
 */
export const classifyLedgerError = (error: unknown): AppError => {
    if (error instanceof AppError) return error

    if (isHwTransportError(error)) {
        const mapped = classifyHwTransportError(error)
        if (mapped) return mapped
        // No specific BLE mapping — fall through to the message-based
        // heuristics below (disconnect/timeout), then the generic default.
    }

    const statusCode = getStatusCode(error)

    if (statusCode !== null) {
        if (
            statusCode === LEDGER_STATUS_CODES.USER_REJECTED ||
            statusCode === LEDGER_STATUS_CODES.USER_REJECTED_LEGACY
        ) {
            return new LedgerUserRejectedError(
                error instanceof Error ? error : undefined,
            )
        }

        if (statusCode === LEDGER_STATUS_CODES.APP_NOT_OPEN) {
            return new LedgerAppNotOpenError(
                error instanceof Error ? error : undefined,
            )
        }

        if (statusCode === LEDGER_STATUS_CODES.LOCKED_DEVICE) {
            return new LedgerDeviceLockedError(
                error instanceof Error ? error : undefined,
            )
        }
    }

    // @ledgerhq/errors maps 0x5515 to a typed LockedDeviceError (name field)
    // in some transport paths instead of surfacing the raw status word.
    if (error instanceof Error && error.name === 'LockedDeviceError') {
        return new LedgerDeviceLockedError(error)
    }

    // Check for disconnect-like errors by message
    if (error instanceof Error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('disconnect') || msg.includes('not connected')) {
            return new LedgerDisconnectedError(error)
        }
        if (msg.includes('timeout')) {
            return new LedgerTimeoutError('device communication', error)
        }
        return new LedgerConnectionError(error.message, error)
    }

    return new LedgerConnectionError(String(error))
}
