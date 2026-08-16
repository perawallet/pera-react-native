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

import type { Nullable } from '../utils/types'

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
    NETWORK = 'network',
    VALIDATION = 'validation',
    ACCOUNTS = 'accounts',
    ASSETS = 'assets',
    BLOCKCHAIN = 'blockchain',
    STORAGE = 'storage',
    UNKNOWN = 'unknown',
    KMS = 'kms',
    WALLETCONNECT = 'walletconnect',
    STAKING = 'staking',
    TRANSACTIONS = 'transactions',
}

export type ErrorMessageKeys = {
    titleKey: string
    bodyKey: string
}

export const messageKeysFor = (base: string): ErrorMessageKeys => ({
    titleKey: `${base}.title`,
    bodyKey: `${base}.body`,
})

/**
 * Metadata attached to every error
 */
export interface ErrorMetadata {
    severity: ErrorSeverity
    category: ErrorCategory
    /**
     * i18n key resolving to the user-facing **body** string. Declaring this is
     * what makes an error user-facing; without it the error surfaces as
     * `errors.general.*` and its `message` stays log-only. Resolved in the app
     * layer — packages must never import i18n.
     */
    messageKey?: string
    /** Interpolation values for `messageKey`; also attached to logs. */
    params?: Record<string, unknown>
    recoverable: boolean
    retryable: boolean
    messageKeys?: ErrorMessageKeys
}

/**
 * Base error class for all application errors
 * Extends Error with structured metadata for logging and user feedback
 */
export class AppError extends Error {
    public readonly metadata: ErrorMetadata
    public readonly timestamp: Date
    public readonly originalError?: Error

    constructor(
        message: string,
        metadata: Partial<ErrorMetadata>,
        originalError?: Error,
    ) {
        super(message)
        this.name = this.constructor.name
        this.timestamp = new Date()
        this.originalError = originalError

        // Merge with defaults
        this.metadata = {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.UNKNOWN,
            recoverable: true,
            retryable: false,
            ...metadata,
        }

        // Capture stack trace (V8 extension available in Node.js and most JS engines)
        const ErrorWithStackTrace = Error as typeof Error & {
            captureStackTrace?: (
                target: object,
                constructor: NewableFunction,
            ) => void
        }
        if (ErrorWithStackTrace.captureStackTrace) {
            ErrorWithStackTrace.captureStackTrace(this, this.constructor)
        }
    }

    /**
     * Check if error is minor (LOW severity)
     */
    isMinor(): boolean {
        return this.metadata.severity === ErrorSeverity.LOW
    }

    /**
     * Check if error should be reported to Crashlytics
     */
    shouldReport(): boolean {
        return (
            this.metadata.severity === ErrorSeverity.HIGH ||
            this.metadata.severity === ErrorSeverity.CRITICAL
        )
    }

    /**
     * Serialize error for logging
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            metadata: this.metadata,
            timestamp: this.timestamp,
            stack: this.stack,
            originalError: this.originalError?.message,
        }
    }
}

/** Checks if an error has the retryable flag set. */
export const isRetryableError = (error: Nullable<Error>): boolean => {
    if (!error || !(error instanceof AppError)) return false
    return error.metadata.retryable === true
}
