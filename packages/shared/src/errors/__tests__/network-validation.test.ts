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

describe('NetworkError', () => {
    test('creates network error with correct metadata', () => {
        const error = new NetworkError('Network request failed')

        expect(error.message).toBe('Network request failed')
        expect(error.metadata.severity).toBe(ErrorSeverity.MEDIUM)
        expect(error.metadata.category).toBe(ErrorCategory.NETWORK)
        expect(error.metadata.retryable).toBe(true)
    })

    test('stores original error', () => {
        const originalError = new Error('Connection failed')
        const error = new NetworkError('Network request failed', originalError)

        expect(error.originalError).toBe(originalError)
    })

    test('extends AppError', () => {
        const error = new NetworkError('Network request failed')

        expect(error instanceof AppError).toBe(true)
        expect(error instanceof NetworkError).toBe(true)
    })
})

describe('ApiError', () => {
    test('creates API error with status code and endpoint', () => {
        const error = new ApiError('Not found', 404, '/api/accounts')

        expect(error.message).toBe('Not found')
        expect(error.statusCode).toBe(404)
        expect(error.endpoint).toBe('/api/accounts')
        expect(error.metadata.params).toEqual({
            statusCode: 404,
            endpoint: '/api/accounts',
        })
    })

    test('creates API error without status code', () => {
        const error = new ApiError('API request failed')

        expect(error.statusCode).toBeUndefined()
        expect(error.endpoint).toBeUndefined()
    })

    test('stores original error', () => {
        const originalError = new Error('HTTP error')
        const error = new ApiError(
            'Server error',
            500,
            '/api/test',
            originalError,
        )

        expect(error.originalError).toBe(originalError)
    })

    test('extends NetworkError', () => {
        const error = new ApiError('API request failed')

        expect(error instanceof NetworkError).toBe(true)
        expect(error instanceof ApiError).toBe(true)
    })
})

describe('TimeoutError', () => {
    test('creates timeout error with correct message', () => {
        const error = new TimeoutError()

        expect(error.message).toBe('A network request has timed out.')
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

        expect(error.message).toBe('No network connection found')
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
        const error = new ValidationError('Validation failed', 'email')

        expect(error.message).toBe('Validation failed')
        expect(error.field).toBe('email')
        expect(error.metadata.params).toEqual({ field: 'email' })
    })

    test('creates validation error without field name', () => {
        const error = new ValidationError('Validation failed')

        expect(error.field).toBeUndefined()
        expect(error.metadata.params).toBeUndefined()
    })

    test('falls back to field name when metadata explicitly sets params to undefined', () => {
        const error = new ValidationError(
            'Validation failed',
            'someField',
            undefined,
            {
                messageKey: 'errors.validation.generic',
                params: undefined,
            },
        )

        expect(error.metadata.params).toEqual({ field: 'someField' })
    })

    test('has LOW severity', () => {
        const error = new ValidationError('Validation failed')

        expect(error.metadata.severity).toBe(ErrorSeverity.LOW)
    })

    test('has validation category', () => {
        const error = new ValidationError('Validation failed')

        expect(error.metadata.category).toBe(ErrorCategory.VALIDATION)
    })

    test('is recoverable but not retryable', () => {
        const error = new ValidationError('Validation failed')

        expect(error.metadata.recoverable).toBe(true)
        expect(error.metadata.retryable).toBe(false)
    })

    test('stores original error', () => {
        const originalError = new Error('Validation failed')
        const error = new ValidationError(
            'Validation failed',
            'field',
            originalError,
        )

        expect(error.originalError).toBe(originalError)
    })

    test('extends AppError', () => {
        const error = new ValidationError('Validation failed')

        expect(error instanceof AppError).toBe(true)
        expect(error instanceof ValidationError).toBe(true)
    })
})

describe('InvalidAddressError', () => {
    test('creates invalid address error with address', () => {
        const address = 'invalid-address-123'
        const error = new InvalidAddressError(address)

        expect(error.message).toBe('Address invalid-address-123 is invalid')
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

        expect(error.message).toBe('Amount -100 is invalid')
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

        expect(error.message).toBe('The Mnemonic provided is invalid')
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

        expect(error.message).toBe('username is required')
        expect(error.field).toBe('username')
    })

    test('extends ValidationError', () => {
        const error = new RequiredFieldError('test')

        expect(error instanceof ValidationError).toBe(true)
    })
})

describe('validation error copy', () => {
    test('InvalidAddressError declares its key and address param', () => {
        const error = new InvalidAddressError('ABC')

        expect(error.metadata.messageKey).toBe(
            'errors.validation.invalid_address',
        )
        expect(error.metadata.params).toEqual({ address: 'ABC' })
    })

    test('InvalidAmountError declares its key and amount param', () => {
        const error = new InvalidAmountError('-1')

        expect(error.metadata.messageKey).toBe(
            'errors.validation.invalid_amount',
        )
        expect(error.metadata.params).toEqual({ amount: '-1' })
    })

    test('RequiredFieldError declares its key and field param', () => {
        const error = new RequiredFieldError('recipient')

        expect(error.metadata.messageKey).toBe(
            'errors.validation.required_field',
        )
        expect(error.metadata.params).toEqual({ field: 'recipient' })
    })

    test('InvalidMnemonicError never carries the passphrase in params', () => {
        const error = new InvalidMnemonicError()

        expect(error.metadata.messageKey).toBe(
            'errors.validation.invalid_mnemonic',
        )
        // `field: 'mnemonic'` is the literal field NAME — safe log context.
        // What must never appear is a param holding the passphrase VALUE.
        expect(error.metadata.params).toEqual({ field: 'mnemonic' })
        expect(Object.keys(error.metadata.params ?? {})).not.toContain(
            'mnemonic',
        )
    })
})
