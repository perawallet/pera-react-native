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
 * Base kms error
 */
export class KeyManagementError extends AppError {
    constructor(
        message: string,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.KMS,
                retryable: false,
                messageKey: 'errors.kms.generic',
                ...metadata,
            },
            originalError,
        )
    }
}

/**
 * Some error occurred using a key
 */
export class KeyAccessError extends KeyManagementError {
    constructor(originalError?: Error) {
        super('Failed to access the signing key', originalError, {
            messageKey: 'errors.kms.key_access_error',
        })
    }
}

/**
 * Key not found in secure storage
 */
export class KeyNotFoundError extends KeyManagementError {
    constructor(keyId: string) {
        super('The specified key was not found.', undefined, {
            severity: ErrorSeverity.CRITICAL,
            messageKey: 'errors.kms.key_not_found',
            params: { keyId },
        })
    }
}

/**
 * Key not found in secure storage
 */
export class InvalidKeyError extends KeyManagementError {
    constructor(keyId: string) {
        super('The specified key is invalid.', undefined, {
            severity: ErrorSeverity.CRITICAL,
            messageKey: 'errors.kms.invalid_key',
            params: { keyId },
        })
    }
}
