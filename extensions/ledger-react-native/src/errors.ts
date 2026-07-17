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

/**
 * BLE connection or scanning failure.
 */
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

/**
 * The Algorand app is not open on the Ledger device (APDU status 0x6e00).
 */
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

/**
 * The device is locked on its PIN screen (APDU status 0x5515). The user
 * unlocks the device and retries — no app-side remediation beyond that.
 */
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

/**
 * No Ledger device is attached over USB at connect time.
 */
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
 * More than one Ledger is attached over USB. The Android HID layer selects
 * by vendorId alone, so a specific device cannot be targeted — the user must
 * disconnect the extras.
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

/**
 * The user rejected an operation on the Ledger device (APDU status 0x6985/0x6986).
 */
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
    }
}

/**
 * The BLE connection was lost during an operation.
 */
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

/**
 * An operation timed out waiting for device response or user confirmation.
 */
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
 * The address returned by the Ledger device does not match the expected address.
 * Guards against signing with the wrong index if the on-device account order
 * or selected app has changed since the account was imported.
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

/**
 * The Ledger device returned an empty signature for a signing request.
 * Indicates a protocol or device-state failure rather than user rejection.
 */
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

/**
 * No transport provider is registered for the requested (manufacturer,
 * transportType) tuple, or no provider was tracked for a scanned device.
 */
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

/**
 * Account discovery completed without finding any usable accounts on the device.
 */
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

/**
 * The device's Bluetooth adapter is disabled at sign time.
 */
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

/**
 * BLE scan permission was denied or revoked.
 */
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
 * BLE scanning cannot run because the OS location services (GPS) toggle is
 * off. Android ≤ 11 requires location services to be enabled for BLE
 * discovery even when the location *permission* is granted — the scan
 * otherwise fails with `react-native-ble-plx` `BleErrorCode.LocationServicesDisabled`
 * (601) and no devices are ever surfaced, leaving the user stuck on "Scan
 * Again". Android 12+ (`neverForLocation`) is unaffected.
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
 * BLE scan completed without locating the target device. Distinct from
 * `LedgerTimeoutError` (which covers any device-communication timeout) so
 * the UI can render scan-specific copy and the troubleshooting link.
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

/**
 * Signature attachment or post-sign processing failed after the device
 * returned a signature. Indicates an internal protocol/encoding failure,
 * not a user action.
 */
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

/**
 * Failed to write a BLE characteristic when sending data to the Ledger.
 */
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

/**
 * Failed to read the device's public key during connect-time verification.
 */
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

/**
 * Network/indexer error during a Ledger-driven flow (e.g. account
 * existence check).
 */
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

/**
 * The connected device returned an unsupported-model indicator.
 */
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
 * `@ledgerhq/react-native-hw-transport-ble` remaps raw `react-native-ble-plx`
 * scan/connect failures to an `@ledgerhq/errors` `HwTransportError` before they
 * reach us. The original numeric `BleErrorCode` survives in two places: the
 * typed `.type` field (for the handful of codes the lib maps) and appended to
 * the message as `". Origin: <code>"` (for every code). We read both so Android
 * BLE scan failures surface as actionable, typed errors instead of a generic
 * retry. Detected structurally (by `name`) to avoid coupling to the lib's
 * class identity across versions.
 *
 * Ref: `@ledgerhq/react-native-hw-transport-ble/.../remapErrors` →
 * `mapBleErrorToHwTransportError`.
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
 * Maps the specific BLE-adapter/location failures we can act on. Returns
 * `null` for anything else so the caller falls through to the shared
 * message-based heuristics (disconnect/timeout) rather than flattening every
 * unmapped transport error to a generic connection error.
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
    // The lib labels a location-permission failure `LocationServicesUnauthorized`
    // (Android maps `BleErrorCode.BluetoothUnauthorized` → this). It's a
    // permission problem, so route it to the permission-denied preset.
    if (error.type === 'LocationServicesUnauthorized') {
        return new LedgerPermissionDeniedError(error)
    }
    if (originCode === BLE_ERROR_CODE.BLUETOOTH_POWERED_OFF) {
        return new LedgerBluetoothDisabledError(error)
    }
    return null
}

/**
 * Maps raw errors from `@algorandfoundation/ledger-algorand-js` or BLE transport
 * to typed Ledger error classes. Pass-through for already-classified
 * AppError instances so re-classification at catch sites preserves the
 * specific error type.
 *
 * Errors that this codebase throws directly (bluetooth disabled, scan
 * timeout, transmission, etc.) are AppError subclasses already, so they
 * fall through the AppError short-circuit without needing a mapping rule.
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
