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

import { describe, test, expect } from 'vitest'
import {
    NetworkError,
    ApiError,
    TimeoutError,
    NoConnectionError,
    ValidationError,
    InvalidAddressError,
    InvalidAmountError,
    InvalidMnemonicError,
    RequiredFieldError,
} from '../network-validation'
import { AppError, ErrorCategory, ErrorSeverity } from '../base'
import { ERROR_I18N_KEYS } from '../i18n-keys'

describe('NetworkError', () => {
    test('creates network error with correct metadata', () => {
        const error = new NetworkError(ERROR_I18N_KEYS.NETWORK_GENERIC)

        expect(error.message).toBe(ERROR_I18N_KEYS.NETWORK_GENERIC)
        expect(error.metadata.severity).toBe(ErrorSeverity.MEDIUM)
        expect(error.metadata.category).toBe(ErrorCategory.NETWORK)
        expect(error.metadata.retryable).toBe(true)
    })

    test('stores original error', () => {
        const originalError = new Error('Connection failed')
        const error = new NetworkError(
            ERROR_I18N_KEYS.NETWORK_GENERIC,
            originalError,
        )

        expect(error.originalError).toBe(originalError)
    })

    test('extends AppError', () => {
        const error = new NetworkError(ERROR_I18N_KEYS.NETWORK_GENERIC)

        expect(error instanceof AppError).toBe(true)
        expect(error instanceof NetworkError).toBe(true)
    })
})

describe('ApiError', () => {
    test('creates API error with status code and endpoint', () => {
        const error = new ApiError(
            ERROR_I18N_KEYS.API_NOT_FOUND,
            404,
            '/api/accounts',
        )

        expect(error.message).toBe(ERROR_I18N_KEYS.API_NOT_FOUND)
        expect(error.statusCode).toBe(404)
        expect(error.endpoint).toBe('/api/accounts')
        expect(error.metadata.params).toEqual({
            statusCode: 404,
            endpoint: '/api/accounts',
        })
    })

    test('creates API error without status code', () => {
        const error = new ApiError(ERROR_I18N_KEYS.API_GENERIC)

        expect(error.statusCode).toBeUndefined()
        expect(error.endpoint).toBeUndefined()
    })

    test('stores original error', () => {
        const originalError = new Error('HTTP error')
        const error = new ApiError(
            ERROR_I18N_KEYS.API_SERVER_ERROR,
            500,
            '/api/test',
            originalError,
        )

        expect(error.originalError).toBe(originalError)
    })

    test('extends NetworkError', () => {
        const error = new ApiError(ERROR_I18N_KEYS.API_GENERIC)

        expect(error instanceof NetworkError).toBe(true)
        expect(error instanceof ApiError).toBe(true)
    })
})

describe('TimeoutError', () => {
    test('creates timeout error with correct message', () => {
        const error = new TimeoutError()

        expect(error.message).toBe(ERROR_I18N_KEYS.NETWORK_TIMEOUT)
    })

    test('has network category', () => {
        const error = new TimeoutError()

        expect(error.metadata.category).toBe(ErrorCategory.NETWORK)
    })

    test('is retryable', () => {
        const error = new TimeoutError()

        expect(error.metadata.retryable).toBe(true)
    })

    test('extends NetworkError', () => {
        const error = new TimeoutError()

        expect(error instanceof NetworkError).toBe(true)
    })
})

describe('NoConnectionError', () => {
    test('creates no connection error with correct message', () => {
        const error = new NoConnectionError()

        expect(error.message).toBe(ERROR_I18N_KEYS.NETWORK_NO_CONNECTION)
    })

    test('has HIGH severity', () => {
        const error = new NoConnectionError()

        expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
    })

    test('has network category', () => {
        const error = new NoConnectionError()

        expect(error.metadata.category).toBe(ErrorCategory.NETWORK)
    })

    test('extends NetworkError', () => {
        const error = new NoConnectionError()

        expect(error instanceof NetworkError).toBe(true)
    })
})

describe('ValidationError', () => {
    test('creates validation error with field name', () => {
        const error = new ValidationError(
            ERROR_I18N_KEYS.VALIDATION_GENERIC,
            'email',
        )

        expect(error.message).toBe(ERROR_I18N_KEYS.VALIDATION_GENERIC)
        expect(error.field).toBe('email')
        expect(error.metadata.params).toEqual({ field: 'email' })
    })

    test('creates validation error without field name', () => {
        const error = new ValidationError(ERROR_I18N_KEYS.VALIDATION_GENERIC)

        expect(error.field).toBeUndefined()
        expect(error.metadata.params).toBeUndefined()
    })

    test('has LOW severity', () => {
        const error = new ValidationError(ERROR_I18N_KEYS.VALIDATION_GENERIC)

        expect(error.metadata.severity).toBe(ErrorSeverity.LOW)
    })

    test('has validation category', () => {
        const error = new ValidationError(ERROR_I18N_KEYS.VALIDATION_GENERIC)

        expect(error.metadata.category).toBe(ErrorCategory.VALIDATION)
    })

    test('is recoverable but not retryable', () => {
        const error = new ValidationError(ERROR_I18N_KEYS.VALIDATION_GENERIC)

        expect(error.metadata.recoverable).toBe(true)
        expect(error.metadata.retryable).toBe(false)
    })

    test('stores original error', () => {
        const originalError = new Error('Validation failed')
        const error = new ValidationError(
            ERROR_I18N_KEYS.VALIDATION_GENERIC,
            'field',
            originalError,
        )

        expect(error.originalError).toBe(originalError)
    })

    test('extends AppError', () => {
        const error = new ValidationError(ERROR_I18N_KEYS.VALIDATION_GENERIC)

        expect(error instanceof AppError).toBe(true)
        expect(error instanceof ValidationError).toBe(true)
    })
})

describe('InvalidAddressError', () => {
    test('creates invalid address error with address', () => {
        const address = 'invalid-address-123'
        const error = new InvalidAddressError(address)

        expect(error.message).toBe(ERROR_I18N_KEYS.VALIDATION_INVALID_ADDRESS)
        expect(error.field).toBe('address')
        expect(error.metadata.params).toEqual({ address })
    })

    test('extends ValidationError', () => {
        const error = new InvalidAddressError('test')

        expect(error instanceof ValidationError).toBe(true)
    })
})

describe('InvalidAmountError', () => {
    test('creates invalid amount error with amount', () => {
        const amount = '-100'
        const error = new InvalidAmountError(amount)

        expect(error.message).toBe(ERROR_I18N_KEYS.VALIDATION_INVALID_AMOUNT)
        expect(error.field).toBe('amount')
        expect(error.metadata.params).toEqual({ amount })
    })

    test('extends ValidationError', () => {
        const error = new InvalidAmountError('0')

        expect(error instanceof ValidationError).toBe(true)
    })
})

describe('InvalidMnemonicError', () => {
    test('creates invalid mnemonic error', () => {
        const error = new InvalidMnemonicError()

        expect(error.message).toBe(ERROR_I18N_KEYS.VALIDATION_INVALID_MNEMONIC)
        expect(error.field).toBe('mnemonic')
    })

    test('extends ValidationError', () => {
        const error = new InvalidMnemonicError()

        expect(error instanceof ValidationError).toBe(true)
    })
})

describe('RequiredFieldError', () => {
    test('creates required field error with field name', () => {
        const error = new RequiredFieldError('username')

        expect(error.message).toBe(ERROR_I18N_KEYS.VALIDATION_REQUIRED_FIELD)
        expect(error.field).toBe('username')
    })

    test('extends ValidationError', () => {
        const error = new RequiredFieldError('test')

        expect(error instanceof ValidationError).toBe(true)
    })
})
