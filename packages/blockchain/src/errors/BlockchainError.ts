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
} from '@perawallet/wallet-core-shared'

/**
 * Base blockchain error
 */
export class BlockchainError extends AppError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.BLOCKCHAIN,
                retryable: false,
                messageKey: 'errors.blockchain.generic',
                ...metadata,
            },
            originalError,
        )
    }
}

/**
 * Transaction-related error
 */
export class TransactionError extends BlockchainError {
    public readonly txId?: string

    constructor(txId?: string, originalError?: Error) {
        super('An error occurred processing the transaction', originalError, {
            messageKey: 'errors.blockchain.transaction',
            // txId is diagnostic only — the copy shows neither it nor the raw
            // cause, but both belong in the log payload.
            params: { txId, cause: originalError?.message },
        })
        this.txId = txId
    }
}

/**
 * Transaction signing failed
 */
export class SigningError extends BlockchainError {
    constructor(originalError?: Error) {
        super(
            'An error occurred signing the transaction or data',
            originalError,
            {
                severity: ErrorSeverity.CRITICAL,
                messageKey: 'errors.blockchain.signing',
                params: { cause: originalError?.message },
            },
        )
    }
}

/**
 * Invalid transaction parameters
 */
export class InvalidTransactionError extends BlockchainError {
    constructor(originalError?: Error) {
        super('The transaction data is invalid or corrupted', originalError, {
            severity: ErrorSeverity.CRITICAL,
            messageKey: 'errors.blockchain.invalid_transaction',
            params: { cause: originalError?.message },
        })
    }
}
