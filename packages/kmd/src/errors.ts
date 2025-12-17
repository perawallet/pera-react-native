import {
    AppError,
    ERROR_I18N_KEYS,
    ErrorCategory,
    ErrorI18nKey,
    ErrorMetadata,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

/**
 * Base kmd error
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
                category: ErrorCategory.KMD,
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
