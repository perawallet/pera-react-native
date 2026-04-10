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

/**
 * Connection or scanning failure for a hardware wallet device.
 */
export class HardwareWalletConnectionError extends AppError {
    constructor(message: string, originalError?: Error) {
        super(
            `Hardware wallet connection error: ${message}`,
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
 * The required app is not open on the hardware wallet device.
 */
export class HardwareWalletAppNotOpenError extends AppError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ?? 'Required app is not open on the hardware wallet device',
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
 * The user rejected an operation on the hardware wallet device.
 */
export class HardwareWalletUserRejectedError extends AppError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ?? 'Operation was rejected on the hardware wallet device',
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
 * The connection to the hardware wallet was lost during an operation.
 */
export class HardwareWalletDisconnectedError extends AppError {
    constructor(message?: string, originalError?: Error) {
        super(
            message ?? 'Hardware wallet device disconnected unexpectedly',
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
export class HardwareWalletTimeoutError extends AppError {
    constructor(operation: string, originalError?: Error) {
        super(
            `Hardware wallet operation timed out: ${operation}`,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: true,
            },
            originalError,
        )
    }
}
