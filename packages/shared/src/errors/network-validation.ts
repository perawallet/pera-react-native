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
    type ErrorMetadata,
    ErrorSeverity,
} from './base'

/**
 * Network-related errors (connectivity, timeouts, etc.)
 */
export class NetworkError extends AppError {
    constructor(message: string, originalError?: Error) {
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
        message: string,
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
        super('A network request has timed out.')
    }
}

/**
 * No network connection error
 */
export class NoConnectionError extends NetworkError {
    constructor() {
        super('No network connection found')
        this.metadata.severity = ErrorSeverity.HIGH
    }
}

/**
 * Base validation error
 */
export class ValidationError extends AppError {
    public readonly field?: string

    constructor(
        message: string,
        /** The invalid field's NAME (e.g. 'mnemonic'), never its value — this reaches logs via `AppError.toJSON`. */
        field?: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.LOW,
                category: ErrorCategory.VALIDATION,
                recoverable: true,
                retryable: false,
                messageKey: 'errors.validation.generic',
                ...metadata,
                // After the spread on purpose: an absent `metadata.params` must
                // fall back to the field name, not overwrite it with undefined.
                params: metadata?.params ?? (field ? { field } : undefined),
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
        super(`Address ${address} is invalid`, 'address', undefined, {
            messageKey: 'errors.validation.invalid_address',
            params: { address },
        })
    }
}

/**
 * Invalid amount (negative, too large, etc.)
 */
export class InvalidAmountError extends ValidationError {
    constructor(amount: string) {
        super(`Amount ${amount} is invalid`, 'amount', undefined, {
            messageKey: 'errors.validation.invalid_amount',
            params: { amount },
        })
    }
}

/**
 * Invalid mnemonic/passphrase
 */
export class InvalidMnemonicError extends ValidationError {
    constructor() {
        super('The Mnemonic provided is invalid', 'mnemonic', undefined, {
            messageKey: 'errors.validation.invalid_mnemonic',
        })
    }
}

/**
 * Required field missing
 */
export class RequiredFieldError extends ValidationError {
    constructor(field: string) {
        super(`${field} is required`, field, undefined, {
            messageKey: 'errors.validation.required_field',
            params: { field },
        })
    }
}
