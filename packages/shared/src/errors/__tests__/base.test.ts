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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { AppError, ErrorSeverity, ErrorCategory } from '../base'
import { ERROR_I18N_KEYS } from '../i18n-keys'

describe('ErrorSeverity', () => {
    test('has correct values', () => {
        expect(ErrorSeverity.LOW).toBe('low')
        expect(ErrorSeverity.MEDIUM).toBe('medium')
        expect(ErrorSeverity.HIGH).toBe('high')
        expect(ErrorSeverity.CRITICAL).toBe('critical')
    })
})

describe('ErrorCategory', () => {
    test('has correct values', () => {
        expect(ErrorCategory.NETWORK).toBe('network')
        expect(ErrorCategory.VALIDATION).toBe('validation')
        expect(ErrorCategory.ACCOUNTS).toBe('accounts')
        expect(ErrorCategory.ASSETS).toBe('assets')
        expect(ErrorCategory.BLOCKCHAIN).toBe('blockchain')
        expect(ErrorCategory.STORAGE).toBe('storage')
        expect(ErrorCategory.UNKNOWN).toBe('unknown')
        expect(ErrorCategory.KMS).toBe('kms')
        expect(ErrorCategory.WALLETCONNECT).toBe('walletconnect')
    })
})

describe('AppError', () => {
    let mockDate: Date

    beforeEach(() => {
        mockDate = new Date('2025-01-20T12:00:00Z')
        vi.useFakeTimers()
        vi.setSystemTime(mockDate)
    })

    test('creates error with i18n key as message', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        expect(error.message).toBe(ERROR_I18N_KEYS.UNKNOWN)
    })

    test('sets error name to class name', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        expect(error.name).toBe('AppError')
    })

    test('sets timestamp to current date', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        expect(error.timestamp).toEqual(mockDate)
    })

    test('applies default metadata', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        expect(error.metadata).toEqual({
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.UNKNOWN,
            recoverable: true,
            retryable: false,
        })
    })

    test('merges provided metadata with defaults', () => {
        const error = new AppError(ERROR_I18N_KEYS.NETWORK_TIMEOUT, {
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.NETWORK,
            retryable: true,
        })

        expect(error.metadata).toEqual({
            severity: ErrorSeverity.HIGH,
            category: ErrorCategory.NETWORK,
            recoverable: true,
            retryable: true,
        })
    })

    test('stores original error when provided', () => {
        const originalError = new Error('Original error')
        const error = new AppError(
            ERROR_I18N_KEYS.UNKNOWN,
            {},
            originalError,
        )

        expect(error.originalError).toBe(originalError)
    })

    test('has no original error when not provided', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        expect(error.originalError).toBeUndefined()
    })

    test('stores metadata params', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            params: { field: 'test', value: 123 },
        })

        expect(error.metadata.params).toEqual({ field: 'test', value: 123 })
    })

    test('isMinor returns true for LOW severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.LOW,
        })

        expect(error.isMinor()).toBe(true)
    })

    test('isMinor returns false for MEDIUM severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.MEDIUM,
        })

        expect(error.isMinor()).toBe(false)
    })

    test('isMinor returns false for HIGH severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.HIGH,
        })

        expect(error.isMinor()).toBe(false)
    })

    test('isMinor returns false for CRITICAL severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.CRITICAL,
        })

        expect(error.isMinor()).toBe(false)
    })

    test('shouldReport returns false for LOW severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.LOW,
        })

        expect(error.shouldReport()).toBe(false)
    })

    test('shouldReport returns false for MEDIUM severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.MEDIUM,
        })

        expect(error.shouldReport()).toBe(false)
    })

    test('shouldReport returns true for HIGH severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.HIGH,
        })

        expect(error.shouldReport()).toBe(true)
    })

    test('shouldReport returns true for CRITICAL severity', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {
            severity: ErrorSeverity.CRITICAL,
        })

        expect(error.shouldReport()).toBe(true)
    })

    test('getI18nKey returns the error message', () => {
        const error = new AppError(ERROR_I18N_KEYS.NETWORK_TIMEOUT, {})

        expect(error.getI18nKey()).toBe(ERROR_I18N_KEYS.NETWORK_TIMEOUT)
    })

    test('toJSON serializes error correctly', () => {
        const error = new AppError(
            ERROR_I18N_KEYS.NETWORK_TIMEOUT,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.NETWORK,
            },
            new Error('Network failed'),
        )

        const json = error.toJSON()

        expect(json).toMatchObject({
            name: 'AppError',
            message: ERROR_I18N_KEYS.NETWORK_TIMEOUT,
            metadata: {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.NETWORK,
                recoverable: true,
                retryable: false,
            },
            timestamp: mockDate,
            originalError: 'Network failed',
        })
        expect(json.stack).toBeDefined()
    })

    test('toJSON handles error without original error', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        const json = error.toJSON()

        expect(json.originalError).toBeUndefined()
    })

    test('has stack trace', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        expect(error.stack).toBeDefined()
        expect(error.stack).toContain('AppError')
    })

    test('extends Error', () => {
        const error = new AppError(ERROR_I18N_KEYS.UNKNOWN, {})

        expect(error instanceof Error).toBe(true)
        expect(error instanceof AppError).toBe(true)
    })
})
