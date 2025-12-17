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

/**
 * Type-safe i18n error message keys
 * All error classes must use keys from this registry note, we centralize it here for ease of use
 * rather than distributing them across multiple packages, even though it's not an ideal solution
 * from a domain design perspective
 */
export const ERROR_I18N_KEYS = {
    // Network errors
    NETWORK_GENERIC: 'errors.network.generic',
    NETWORK_TIMEOUT: 'errors.network.timeout',
    NETWORK_NO_CONNECTION: 'errors.network.no_connection',

    // API errors
    API_GENERIC: 'errors.api.generic',
    API_NOT_FOUND: 'errors.api.not_found',
    API_UNAUTHORIZED: 'errors.api.unauthorized',
    API_SERVER_ERROR: 'errors.api.server_error',

    // Blockchain errors
    BLOCKCHAIN_GENERIC: 'errors.blockchain.generic',
    BLOCKCHAIN_TRANSACTION: 'errors.blockchain.transaction',
    BLOCKCHAIN_INVALID_TRANSACTION: 'errors.blockchain.invalid_transaction',

    // Account errors
    ACCOUNT_GENERIC: 'errors.account.generic',
    ACCOUNT_NO_HD_WALLET: 'errors.account.no_hd_wallet',
    KEY_ACCESS_ERROR: 'errors.account.key_access_error',

    // KMD errors
    KEY_NOT_FOUND: 'errors.kmd.key_not_found',
    KEY_ACCESS: 'errors.kmd.key_access_error',
    INVALID_KEY: 'errors.kmd.invalid_key',

    // Validation errors
    VALIDATION_GENERIC: 'errors.validation.generic',
    VALIDATION_INVALID_ADDRESS: 'errors.validation.invalid_address',
    VALIDATION_INVALID_AMOUNT: 'errors.validation.invalid_amount',
    VALIDATION_INVALID_MNEMONIC: 'errors.validation.invalid_mnemonic',
    VALIDATION_REQUIRED_FIELD: 'errors.validation.required_field',

    // Authentication errors
    AUTH_GENERIC: 'errors.auth.generic',
    AUTH_BIOMETRIC_FAILED: 'errors.auth.biometric_failed',
    AUTH_PIN_INCORRECT: 'errors.auth.pin_incorrect',

    // Storage errors
    STORAGE_GENERIC: 'errors.storage.generic',
    STORAGE_READ_FAILED: 'errors.storage.read_failed',
    STORAGE_WRITE_FAILED: 'errors.storage.write_failed',

    // Unknown/Generic
    UNKNOWN: 'errors.unknown',
} as const

/**
 * Type representing all valid error i18n keys
 */
export type ErrorI18nKey =
    (typeof ERROR_I18N_KEYS)[keyof typeof ERROR_I18N_KEYS]

/**
 * Helper to get all error keys for linting/validation
 */
export const getAllErrorKeys = (): ErrorI18nKey[] => {
    return Object.values(ERROR_I18N_KEYS)
}
