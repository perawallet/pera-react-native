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
    KeyManagementError,
    KeyAccessError,
    KeyNotFoundError,
    InvalidKeyError,
} from '../errors'
import {
    AppError,
    ErrorSeverity,
    ErrorCategory,
} from '@perawallet/wallet-core-shared'

describe('KMS Error Classes', () => {
    describe('KeyManagementError', () => {
        test('extends AppError', () => {
            const error = new KeyManagementError('Key access failed')
            expect(error).toBeInstanceOf(AppError)
            expect(error).toBeInstanceOf(Error)
        })

        test('has HIGH severity and KMS category by default', () => {
            const error = new KeyManagementError('Key access failed')
            expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
            expect(error.metadata.category).toBe(ErrorCategory.KMS)
            expect(error.metadata.retryable).toBe(false)
        })

        test('uses provided message', () => {
            const error = new KeyManagementError('Key access failed')
            expect(error.message).toBe('Key access failed')
        })

        test('preserves original error', () => {
            const cause = new Error('original cause')
            const error = new KeyManagementError('Key access failed', cause)
            expect(error.originalError).toBe(cause)
        })

        test('allows metadata override', () => {
            const error = new KeyManagementError(
                'Key access failed',
                undefined,
                { severity: ErrorSeverity.CRITICAL, retryable: true },
            )
            expect(error.metadata.severity).toBe(ErrorSeverity.CRITICAL)
            expect(error.metadata.retryable).toBe(true)
            expect(error.metadata.category).toBe(ErrorCategory.KMS)
        })

        test('shouldReport returns true for HIGH severity', () => {
            const error = new KeyManagementError('Key access failed')
            expect(error.shouldReport()).toBe(true)
        })
    })

    describe('KeyAccessError', () => {
        test('extends KeyManagementError', () => {
            const error = new KeyAccessError()
            expect(error).toBeInstanceOf(KeyManagementError)
            expect(error).toBeInstanceOf(AppError)
        })

        test('uses correct message', () => {
            const error = new KeyAccessError()
            expect(error.message).toBe('Failed to access the signing key')
        })

        test('can be constructed without arguments', () => {
            const error = new KeyAccessError()
            expect(error.originalError).toBeUndefined()
        })

        test('preserves original error when provided', () => {
            const cause = new Error('access denied')
            const error = new KeyAccessError(cause)
            expect(error.originalError).toBe(cause)
        })

        test('has HIGH severity and KMS category', () => {
            const error = new KeyAccessError()
            expect(error.metadata.severity).toBe(ErrorSeverity.HIGH)
            expect(error.metadata.category).toBe(ErrorCategory.KMS)
        })
    })

    describe('KeyNotFoundError', () => {
        test('extends KeyManagementError', () => {
            const error = new KeyNotFoundError('key-123')
            expect(error).toBeInstanceOf(KeyManagementError)
            expect(error).toBeInstanceOf(AppError)
        })

        test('uses correct message', () => {
            const error = new KeyNotFoundError('key-123')
            expect(error.message).toBe('The specified key was not found.')
        })

        test('has CRITICAL severity', () => {
            const error = new KeyNotFoundError('key-123')
            expect(error.metadata.severity).toBe(ErrorSeverity.CRITICAL)
        })

        test('includes keyId in metadata params', () => {
            const error = new KeyNotFoundError('key-123')
            expect(error.metadata.params).toEqual({ keyId: 'key-123' })
        })
    })

    describe('InvalidKeyError', () => {
        test('extends KeyManagementError', () => {
            const error = new InvalidKeyError('key-456')
            expect(error).toBeInstanceOf(KeyManagementError)
            expect(error).toBeInstanceOf(AppError)
        })

        test('uses correct message', () => {
            const error = new InvalidKeyError('key-456')
            expect(error.message).toBe('The specified key is invalid.')
        })

        test('has CRITICAL severity', () => {
            const error = new InvalidKeyError('key-456')
            expect(error.metadata.severity).toBe(ErrorSeverity.CRITICAL)
        })

        test('includes keyId in metadata params', () => {
            const error = new InvalidKeyError('key-456')
            expect(error.metadata.params).toEqual({ keyId: 'key-456' })
        })
    })
})

describe('kms error copy', () => {
    test('KeyAccessError declares the kms key-access key', () => {
        const error = new KeyAccessError()

        expect(error.metadata.messageKey).toBe('errors.kms.key_access_error')
    })

    test('KeyNotFoundError param name matches the copy placeholder', () => {
        const error = new KeyNotFoundError('wallet-1')

        expect(error.metadata.messageKey).toBe('errors.kms.key_not_found')
        expect(error.metadata.params).toEqual({ keyId: 'wallet-1' })
    })

    test('InvalidKeyError param name matches the copy placeholder', () => {
        const error = new InvalidKeyError('wallet-1')

        expect(error.metadata.messageKey).toBe('errors.kms.invalid_key')
        expect(error.metadata.params).toEqual({ keyId: 'wallet-1' })
    })
})
