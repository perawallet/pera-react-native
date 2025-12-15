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

import { ErrorI18nKey } from './i18n-keys'

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
}

/**
 * Metadata attached to every error
 */
export interface ErrorMetadata {
    severity: ErrorSeverity
    category: ErrorCategory
    params?: Record<string, unknown>
    recoverable: boolean
    retryable: boolean
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
        i18nKey: ErrorI18nKey,
        metadata: Partial<ErrorMetadata>,
        originalError?: Error,
    ) {
        super(i18nKey)
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

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor)
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
     * Get user-facing message (if available) or default message
     */
    getI18nKey(): ErrorI18nKey {
        return this.message as ErrorI18nKey
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
