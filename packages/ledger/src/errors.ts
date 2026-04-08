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
    AppError,
    ErrorCategory,
    ErrorSeverity,
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
 * Extract the APDU status code from a Ledger SDK error.
 * Ledger errors typically have a `statusCode` property.
 */
const getStatusCode = (error: unknown): number | null => {
    if (
        error !== null &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof (error as { statusCode: unknown }).statusCode === 'number'
    ) {
        return (error as { statusCode: number }).statusCode
    }
    return null
}

/**
 * Maps raw errors from `@ledgerhq/hw-app-algorand` or BLE transport
 * to typed Ledger error classes.
 */
export const classifyLedgerError = (error: unknown): AppError => {
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
