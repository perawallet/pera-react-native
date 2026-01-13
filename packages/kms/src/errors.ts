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
    ERROR_I18N_KEYS,
    ErrorCategory,
    ErrorI18nKey,
    ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

/**
 * Base kms error
 */
export class KeyManagementError extends AppError {
    constructor(
        message: ErrorI18nKey,
        originalError?: Error,
        metadata?: Partial<ErrorMetadata>,
    ) {
        super(
            message,
            {
                severity: ErrorSeverity.HIGH,
                category: ErrorCategory.KMS,
                retryable: false,
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
        super(ERROR_I18N_KEYS.KEY_ACCESS, originalError)
    }
}

/**
 * Key not found in secure storage
 */
export class KeyNotFoundError extends KeyManagementError {
    constructor(walletId: string) {
        super(ERROR_I18N_KEYS.KEY_NOT_FOUND, undefined, {
            severity: ErrorSeverity.CRITICAL,
            params: { walletId },
        })
    }
}

/**
 * Key not found in secure storage
 */
export class InvalidKeyError extends KeyManagementError {
    constructor(walletId: string) {
        super(ERROR_I18N_KEYS.INVALID_KEY, undefined, {
            severity: ErrorSeverity.CRITICAL,
            params: { walletId },
        })
    }
}
