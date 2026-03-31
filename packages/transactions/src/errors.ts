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

import {
    AppError,
    ErrorCategory,
    ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

/**
 * Base blockchain error
 */
export class TransactionError extends AppError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.TRANSACTIONS,
                retryable: false,
                ...metadata,
            },
            originalError,
        )
    }
}

/**
 * Transaction-related error
 */
export class InvalidSendParamsError extends TransactionError {
    constructor(params?: string[], originalError?: Error) {
        super('The transaction appears to be invalid', originalError, {
            params: {
                errorParams: params,
            },
        })
    }
}

export class AlreadyOptedInError extends TransactionError {
    constructor() {
        super('Account is already opted in to this asset')
    }
}

export class InsufficientBalanceForOptInError extends TransactionError {
    constructor() {
        super(
            'Insufficient ALGO balance to opt in. Account needs enough to cover the minimum balance requirement and transaction fee.',
        )
    }
}

export class NonZeroBalanceError extends TransactionError {
    constructor() {
        super(
            'Cannot opt out of an asset with a non-zero balance. Transfer the remaining balance first.',
        )
    }
}

export class CreatorCannotOptOutError extends TransactionError {
    constructor() {
        super('Asset creators cannot opt out of their own assets.')
    }
}
