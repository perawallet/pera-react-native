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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
    AppError,
    ErrorSeverity,
    ErrorCategory,
    isRetryableError,
} from '../base'

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

    test('creates error with message', () => {
        const error = new AppError('Something went wrong', {})

        expect(error.message).toBe('Something went wrong')
    })

    test('sets error name to class name', () => {
        const error = new AppError('Something went wrong', {})

        expect(error.name).toBe('AppError')
    })

    test('sets timestamp to current date', () => {
        const error = new AppError('Something went wrong', {})

        expect(error.timestamp).toEqual(mockDate)
    })

    test('applies default metadata', () => {
        const error = new AppError('Something went wrong', {})

        expect(error.metadata).toEqual({
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.UNKNOWN,
            recoverable: true,
            retryable: false,
        })
    })

    test('merges provided metadata with defaults', () => {
        const error = new AppError('Network timed out', {
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
        const error = new AppError('Something went wrong', {}, originalError)

        expect(error.originalError).toBe(originalError)
    })

    test('has no original error when not provided', () => {
        const error = new AppError('Something went wrong', {})

        expect(error.originalError).toBeUndefined()
    })

    test('stores metadata params', () => {
        const error = new AppError('Something went wrong', {
            params: { field: 'test', value: 123 },
        })

        expect(error.metadata.params).toEqual({ field: 'test', value: 123 })
    })

    test('isMinor returns true for LOW severity', () => {
        const error = new AppError('Something went wrong', {
            severity: ErrorSeverity.LOW,
        })

        expect(error.isMinor()).toBe(true)
    })

    test('isMinor returns false for MEDIUM severity', () => {
        const error = new AppError('Something went wrong', {
            severity: ErrorSeverity.MEDIUM,
        })

        expect(error.isMinor()).toBe(false)
    })

    test('isMinor returns false for HIGH severity', () => {
        const error = new AppError('Something went wrong', {
            severity: ErrorSeverity.HIGH,
        })

        expect(error.isMinor()).toBe(false)
    })

    test('isMinor returns false for CRITICAL severity', () => {
        const error = new AppError('Something went wrong', {
            severity: ErrorSeverity.CRITICAL,
        })

        expect(error.isMinor()).toBe(false)
    })

    test('toJSON serializes error correctly', () => {
        const error = new AppError(
            'Network timed out',
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.NETWORK,
            },
            new Error('Network failed'),
        )

        const json = error.toJSON()

        expect(json).toMatchObject({
            name: 'AppError',
            message: 'Network timed out',
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
        const error = new AppError('Something went wrong', {})

        const json = error.toJSON()

        expect(json.originalError).toBeUndefined()
    })

    test('has stack trace', () => {
        const error = new AppError('Something went wrong', {})

        expect(error.stack).toBeDefined()
        expect(error.stack).toContain('AppError')
    })

    test('extends Error', () => {
        const error = new AppError('Something went wrong', {})

        expect(error instanceof Error).toBe(true)
        expect(error instanceof AppError).toBe(true)
    })
})

describe('isRetryableError', () => {
    test('returns false for null', () => {
        expect(isRetryableError(null)).toBe(false)
    })

    test('returns false for undefined', () => {
        expect(isRetryableError(undefined as unknown as Error)).toBe(false)
    })

    test('returns false for a plain Error', () => {
        expect(isRetryableError(new Error('boom'))).toBe(false)
    })

    test('returns false for a non-retryable AppError', () => {
        const error = new AppError('not retryable', { retryable: false })
        expect(isRetryableError(error)).toBe(false)
    })

    test('returns true for a retryable AppError', () => {
        const error = new AppError('retryable', { retryable: true })
        expect(isRetryableError(error)).toBe(true)
    })
})

describe('AppError messageKey', () => {
    test('preserves messageKey and params on the instance', () => {
        const error = new AppError('log-only text', {
            category: ErrorCategory.VALIDATION,
            messageKey: 'errors.validation.invalid_address',
            params: { address: 'ABC' },
        })

        expect(error.metadata.messageKey).toBe(
            'errors.validation.invalid_address',
        )
        expect(error.metadata.params).toEqual({ address: 'ABC' })
    })

    test('leaves messageKey undefined when not declared', () => {
        const error = new AppError('log-only text', {})

        expect(error.metadata.messageKey).toBeUndefined()
    })

    test('includes messageKey in the serialized form', () => {
        const error = new AppError('log-only text', {
            messageKey: 'errors.validation.generic',
        })

        expect(error.toJSON().metadata.messageKey).toBe(
            'errors.validation.generic',
        )
    })
})
