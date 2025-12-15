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

import { AppError, ErrorCategory, ErrorSeverity } from './base'
import { ERROR_I18N_KEYS, ErrorI18nKey } from './i18n-keys'

/**
 * Network-related errors (connectivity, timeouts, etc.)
 */
export class NetworkError extends AppError {
    constructor(message: ErrorI18nKey, originalError?: Error) {
        super(
            message,
            {
                severity: ErrorSeverity.MEDIUM,
                category: ErrorCategory.NETWORK,
                retryable: true,
            },
            originalError,
        )
    }
}

/**
 * API/HTTP errors with status code information
 */
export class ApiError extends NetworkError {
    public readonly statusCode?: number
    public readonly endpoint?: string

    constructor(
        message: ErrorI18nKey,
        statusCode?: number,
        endpoint?: string,
        originalError?: Error,
    ) {
        super(message, originalError)
        this.statusCode = statusCode
        this.endpoint = endpoint
        this.metadata.params = { statusCode, endpoint }
    }
}

/**
 * Request timeout error
 */
export class TimeoutError extends NetworkError {
    constructor() {
        super(ERROR_I18N_KEYS.NETWORK_TIMEOUT)
    }
}

/**
 * No network connection error
 */
export class NoConnectionError extends NetworkError {
    constructor() {
        super(ERROR_I18N_KEYS.NETWORK_NO_CONNECTION)
        this.metadata.severity = ErrorSeverity.HIGH
    }
}

/**
 * Base validation error
 */
export class ValidationError extends AppError {
    public readonly field?: string

    constructor(message: ErrorI18nKey, field?: string, originalError?: Error) {
        super(
            message,
            {
                severity: ErrorSeverity.LOW,
                category: ErrorCategory.VALIDATION,
                recoverable: true,
                retryable: false,
                params: field ? { field } : undefined,
            },
            originalError,
        )
        this.field = field
    }
}

/**
 * Invalid Algorand address format
 */
export class InvalidAddressError extends ValidationError {
    constructor(address: string) {
        super(ERROR_I18N_KEYS.VALIDATION_INVALID_ADDRESS, 'address')
        this.metadata.params = { address }
    }
}

/**
 * Invalid amount (negative, too large, etc.)
 */
export class InvalidAmountError extends ValidationError {
    constructor(amount: string) {
        super(ERROR_I18N_KEYS.VALIDATION_INVALID_AMOUNT, 'amount')
        this.metadata.params = { amount }
    }
}

/**
 * Invalid mnemonic/passphrase
 */
export class InvalidMnemonicError extends ValidationError {
    constructor() {
        super(ERROR_I18N_KEYS.VALIDATION_INVALID_MNEMONIC, 'mnemonic')
    }
}

/**
 * Required field missing
 */
export class RequiredFieldError extends ValidationError {
    constructor(field: string) {
        super(ERROR_I18N_KEYS.VALIDATION_REQUIRED_FIELD, field)
    }
}
