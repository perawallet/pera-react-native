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

const { LOW, MEDIUM, HIGH } = ErrorSeverity

type LedgerErrorOptions = {
    /**
     * Pinned rather than derived: AppError reads `constructor.name`, which a
     * minifier can mangle, and the swap flow matches `LedgerUserRejectedError`
     * by name to avoid a value import of this package.
     */
    name: string
    message: string
    severity: ErrorSeverity
    retryable: boolean
    /**
     * Suppresses crash reporting without touching `severity`, which still
     * drives the user-facing copy.
     */
    expected?: true
    params?: Record<string, unknown>
    originalError?: Error
}

/** Base for every typed Ledger device/transport error. */
export abstract class LedgerError extends AppError {
    protected constructor({
        name,
        message,
        severity,
        retryable,
        expected,
        params,
        originalError,
    }: LedgerErrorOptions) {
        super(
            message,
            {
                severity,
                category: ErrorCategory.BLOCKCHAIN,
                retryable,
                ...(expected ? { expected } : {}),
                ...(params ? { params } : {}),
            },
            originalError,
        )
        this.name = name
    }
}

export class LedgerConnectionError extends LedgerError {
    constructor(detail: string, originalError?: Error) {
        super({
            name: 'LedgerConnectionError',
            message: `Ledger connection error: ${detail}`,
            severity: HIGH,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/** APDU status 0x6e00. */
export class LedgerAppNotOpenError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerAppNotOpenError',
            message: 'Algorand app is not open on the Ledger device',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/** APDU status 0x5515. No app-side remediation — the user unlocks and retries. */
export class LedgerDeviceLockedError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerDeviceLockedError',
            message: 'The Ledger device is locked',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/**
 * Nothing answered at the stored device id — powered off, out of range, or the
 * BLE stack could not open a link. BLE cannot tell those apart (there is no
 * "off" signal, only absence), so the user-facing copy covers both causes.
 *
 * Distinct from `LedgerScanTimeoutError`, which means no device appeared during
 * *discovery*; this is a failure to reach a device we already know about.
 */
export class LedgerDeviceNotFoundError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerDeviceNotFoundError',
            message: 'No Ledger device could be reached',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/**
 * An APDU exchange is still in flight on the transport (`TransportRaceCondition`)
 * or the device is mid-prompt from another host. Retrying after the current
 * on-device action completes is the only remediation.
 */
export class LedgerDeviceBusyError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerDeviceBusyError',
            message: 'The Ledger device is busy with another operation',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

export class LedgerUsbNoDeviceError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerUsbNoDeviceError',
            message: 'No Ledger connected over USB',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/**
 * The Android HID layer selects by vendorId alone, so a specific device can't
 * be targeted — the user must disconnect the extras.
 */
export class LedgerUsbMultipleDevicesError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerUsbMultipleDevicesError',
            message: 'Multiple Ledger devices are connected over USB',
            severity: MEDIUM,
            retryable: true,
            originalError,
        })
    }
}

/** APDU status 0x6985/0x6986. */
export class LedgerUserRejectedError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerUserRejectedError',
            message: 'Operation was rejected on the Ledger device',
            severity: LOW,
            retryable: false,
            expected: true,
            originalError,
        })
    }
}

export class LedgerDisconnectedError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerDisconnectedError',
            message: 'Ledger device disconnected unexpectedly',
            severity: HIGH,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

export class LedgerTimeoutError extends LedgerError {
    constructor(detail: string, originalError?: Error) {
        super({
            name: 'LedgerTimeoutError',
            message: `Ledger operation timed out: ${detail}`,
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/**
 * Guards against signing with the wrong index when the on-device account order
 * or selected app changed since the account was imported.
 */
export class LedgerAddressMismatchError extends LedgerError {
    constructor(expected: string, actual: string, originalError?: Error) {
        super({
            name: 'LedgerAddressMismatchError',
            message: `Ledger address mismatch: expected ${expected} but got ${actual}`,
            severity: HIGH,
            retryable: false,
            params: { expected, actual },
            originalError,
        })
    }
}

/** Empty signature returned — a protocol/device-state failure, not a rejection. */
export class LedgerSigningError extends LedgerError {
    constructor(detail: string, originalError?: Error) {
        super({
            name: 'LedgerSigningError',
            message: `Ledger signing error: ${detail}`,
            severity: HIGH,
            retryable: true,
            originalError,
        })
    }
}

/** No provider registered for the (manufacturer, transportType) tuple. */
export class LedgerProviderNotFoundError extends LedgerError {
    constructor(reason: string, originalError?: Error) {
        super({
            name: 'LedgerProviderNotFoundError',
            message: `Ledger provider not found: ${reason}`,
            severity: HIGH,
            retryable: false,
            params: { reason },
            originalError,
        })
    }
}

export class LedgerNoAccountsFoundError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerNoAccountsFoundError',
            message: 'No accounts were found on this Ledger device',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

export class LedgerBluetoothDisabledError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerBluetoothDisabledError',
            message:
                'Bluetooth must be enabled to communicate with a Ledger device',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

export class LedgerPermissionDeniedError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerPermissionDeniedError',
            message:
                'Bluetooth scan permission is required to search for nearby Ledger devices',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/**
 * Android <= 11 needs the location services *toggle* on for BLE discovery even
 * when the permission is granted; without it the scan fails with ble-plx 601
 * and surfaces no devices, stranding the user on "Scan Again". Android 12+
 * (`neverForLocation`) is unaffected.
 */
export class LedgerLocationServicesDisabledError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerLocationServicesDisabledError',
            message:
                'Location services must be enabled to search for nearby Ledger devices',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/**
 * Distinct from `LedgerTimeoutError` so the UI can render scan-specific copy
 * and the troubleshooting link.
 */
export class LedgerScanTimeoutError extends LedgerError {
    constructor(detail: string, originalError?: Error) {
        super({
            name: 'LedgerScanTimeoutError',
            message: `Ledger scan timed out: ${detail}`,
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

/** Post-sign processing failed — an encoding failure, not a user action. */
export class LedgerSigningFailedError extends LedgerError {
    constructor(detail: string, originalError?: Error) {
        super({
            name: 'LedgerSigningFailedError',
            message: `Ledger signing failed: ${detail}`,
            severity: HIGH,
            retryable: true,
            originalError,
        })
    }
}

export class LedgerTransmissionError extends LedgerError {
    constructor(detail: string, originalError?: Error) {
        super({
            name: 'LedgerTransmissionError',
            message: `Ledger transmission failed: ${detail}`,
            severity: HIGH,
            retryable: true,
            originalError,
        })
    }
}

export class LedgerPublicKeyReadError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerPublicKeyReadError',
            message: 'Failed to read public key from Ledger device',
            severity: HIGH,
            retryable: true,
            originalError,
        })
    }
}

/** e.g. the indexer account-existence check. */
export class LedgerNetworkError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerNetworkError',
            message: 'Network error during Ledger operation',
            severity: MEDIUM,
            retryable: true,
            expected: true,
            originalError,
        })
    }
}

export class LedgerUnsupportedDeviceError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerUnsupportedDeviceError',
            message: 'This Ledger device is not supported',
            severity: HIGH,
            retryable: false,
            expected: true,
            originalError,
        })
    }
}

/**
 * The device's Algorand app is too old to support arbitrary-data (ARC-60)
 * signing — it lacks the SIGN_ARBITRARY instruction. The user must update
 * the Algorand app via Ledger Live.
 */
export class LedgerAppOutdatedError extends LedgerError {
    constructor(originalError?: Error) {
        super({
            name: 'LedgerAppOutdatedError',
            message:
                'The Ledger Algorand app must be updated to sign this request',
            severity: MEDIUM,
            retryable: false,
            expected: true,
            originalError,
        })
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
 * `@ledgerhq/errors` classes, matched by `name` rather than `instanceof`: the
 * lib creates them via a factory whose identity is not stable across the
 * multiple copies pnpm can hoist, and a minifier may mangle the constructor.
 * The names themselves are part of the lib's wire contract (they survive the
 * transport's own serialization) and are stable across versions.
 */
const LIB_ERROR_FACTORY_BY_NAME: Record<string, (error: Error) => AppError> = {
    LockedDeviceError: error => new LedgerDeviceLockedError(error),
    // The BLE transport could not open a link to the device.
    CantOpenDevice: error => new LedgerDeviceNotFoundError(error),
    DisconnectedDevice: error => new LedgerDisconnectedError(error),
    DisconnectedDeviceDuringOperation: error =>
        new LedgerDisconnectedError(error),
    TransportRaceCondition: error => new LedgerDeviceBusyError(error),
    UnresponsiveDeviceError: error =>
        new LedgerTimeoutError('device communication', error),
}

/** Maps a raw transport/SDK error to a typed Ledger error. */
export type LedgerErrorClassifier = (error: unknown) => AppError

/**
 * Transport-neutral: a transport with its own error shapes (the RN BLE
 * transport's `HwTransportError`) classifies those first and falls back here.
 *
 * Pass-through for already-classified AppErrors, so re-classifying at a catch
 * site preserves the specific type — which is also why errors this codebase
 * throws directly need no mapping rule.
 */
export const classifyLedgerError: LedgerErrorClassifier = error => {
    if (error instanceof AppError) return error

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

        if (statusCode === LEDGER_STATUS_CODES.INSTRUCTION_NOT_SUPPORTED) {
            return new LedgerAppOutdatedError(
                error instanceof Error ? error : undefined,
            )
        }
    }

    if (error instanceof Error) {
        // Typed transport errors (including 0x5515 delivered as
        // LockedDeviceError instead of a raw status word) before the message
        // heuristics, which are a last resort.
        const fromLib = LIB_ERROR_FACTORY_BY_NAME[error.name]
        if (fromLib) return fromLib(error)

        const msg = error.message.toLowerCase()
        if (msg.includes('busy') || msg.includes('race condition')) {
            return new LedgerDeviceBusyError(error)
        }
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
