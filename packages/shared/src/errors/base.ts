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

import type { I18nKey } from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional } from '../utils/types'

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

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
    CONNECTIONS = 'connections',
    STAKING = 'staking',
    TRANSACTIONS = 'transactions',
}

export type ErrorMessageKeys = {
    titleKey: I18nKey
    bodyKey: I18nKey
}

export interface ErrorMetadata {
    severity: ErrorSeverity
    category: ErrorCategory
    /**
     * i18n key resolving to the user-facing **body** string. Declaring this is
     * what makes an error user-facing; without it the error surfaces as
     * `errors.general.*` and its `message` stays log-only. Resolved in the app
     * layer — packages must never import i18n.
     */
    messageKey?: I18nKey
    /**
     * Overrides the category title. Only for errors specific enough to name the
     * situation ("Asset frozen"); leaving it unset is the norm.
     */
    titleKey?: I18nKey
    /** Interpolation values for `messageKey`; also attached to logs. */
    params?: Record<string, unknown>
    recoverable: boolean
    retryable: boolean
    /**
     * Suppresses crash reporting for this error: it drops to a warning plus a
     * breadcrumb instead of a non-fatal. Orthogonal to `severity`, which drives
     * user-facing copy — a HIGH-severity Ledger disconnect still deserves a
     * loud message on screen and still deserves nothing in Crashlytics.
     */
    expected?: boolean
    /**
     * A stable, namespaced code for the failure (`<source>.<code>`),
     * independent of message and copy. Crash reports group by it and analytics
     * carry it. Set it on an error one factory builds for many causes, whose
     * shared stack can't tell them apart.
     */
    reportCode?: string
}

// oxlint-disable-next-line pera/typed-domain-errors -- the base every domain error extends
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

        this.metadata = {
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.UNKNOWN,
            recoverable: true,
            retryable: false,
            ...metadata,
        }

        // `captureStackTrace` is a V8 extension; absent on other engines.
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

    isMinor(): boolean {
        return this.metadata.severity === ErrorSeverity.LOW
    }

    shouldReport(): boolean {
        return (
            this.metadata.severity === ErrorSeverity.HIGH ||
            this.metadata.severity === ErrorSeverity.CRITICAL
        )
    }

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

const MAX_REPORT_CODE_DEPTH = 8

export const reportCodeOf = (error: unknown): Optional<string> => {
    let current: unknown = error
    for (
        let depth = 0;
        depth < MAX_REPORT_CODE_DEPTH && current instanceof AppError;
        depth++
    ) {
        if (current.metadata.reportCode !== undefined) {
            return current.metadata.reportCode
        }
        current = current.originalError
    }
    return undefined
}

export const isRetryableError = (error: Nullable<Error>): boolean => {
    if (!error || !(error instanceof AppError)) return false
    return error.metadata.retryable === true
}
