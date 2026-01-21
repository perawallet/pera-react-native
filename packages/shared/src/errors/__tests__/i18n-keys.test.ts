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

import { describe, test, expect } from 'vitest'
import { ERROR_I18N_KEYS, getAllErrorKeys } from '../i18n-keys'

describe('ERROR_I18N_KEYS', () => {
    test('has network error keys', () => {
        expect(ERROR_I18N_KEYS.NETWORK_GENERIC).toBe('errors.network.generic')
        expect(ERROR_I18N_KEYS.NETWORK_TIMEOUT).toBe('errors.network.timeout')
        expect(ERROR_I18N_KEYS.NETWORK_NO_CONNECTION).toBe(
            'errors.network.no_connection',
        )
    })

    test('has API error keys', () => {
        expect(ERROR_I18N_KEYS.API_GENERIC).toBe('errors.api.generic')
        expect(ERROR_I18N_KEYS.API_NOT_FOUND).toBe('errors.api.not_found')
        expect(ERROR_I18N_KEYS.API_UNAUTHORIZED).toBe('errors.api.unauthorized')
        expect(ERROR_I18N_KEYS.API_SERVER_ERROR).toBe('errors.api.server_error')
    })

    test('has blockchain error keys', () => {
        expect(ERROR_I18N_KEYS.BLOCKCHAIN_GENERIC).toBe(
            'errors.blockchain.generic',
        )
        expect(ERROR_I18N_KEYS.BLOCKCHAIN_TRANSACTION).toBe(
            'errors.blockchain.transaction',
        )
        expect(ERROR_I18N_KEYS.BLOCKCHAIN_INVALID_TRANSACTION).toBe(
            'errors.blockchain.invalid_transaction',
        )
        expect(ERROR_I18N_KEYS.BLOCKCHAIN_SIGNING).toBe(
            'errors.blockchain.signing',
        )
    })

    test('has account error keys', () => {
        expect(ERROR_I18N_KEYS.ACCOUNT_GENERIC).toBe('errors.account.generic')
        expect(ERROR_I18N_KEYS.ACCOUNT_NO_HD_WALLET).toBe(
            'errors.account.no_hd_wallet',
        )
        expect(ERROR_I18N_KEYS.KEY_ACCESS_ERROR).toBe(
            'errors.account.key_access_error',
        )
    })

    test('has KMS error keys', () => {
        expect(ERROR_I18N_KEYS.KEY_NOT_FOUND).toBe('errors.kms.key_not_found')
        expect(ERROR_I18N_KEYS.KEY_ACCESS).toBe('errors.kms.key_access_error')
        expect(ERROR_I18N_KEYS.INVALID_KEY).toBe('errors.kms.invalid_key')
    })

    test('has validation error keys', () => {
        expect(ERROR_I18N_KEYS.VALIDATION_GENERIC).toBe(
            'errors.validation.generic',
        )
        expect(ERROR_I18N_KEYS.VALIDATION_INVALID_ADDRESS).toBe(
            'errors.validation.invalid_address',
        )
        expect(ERROR_I18N_KEYS.VALIDATION_INVALID_AMOUNT).toBe(
            'errors.validation.invalid_amount',
        )
        expect(ERROR_I18N_KEYS.VALIDATION_INVALID_MNEMONIC).toBe(
            'errors.validation.invalid_mnemonic',
        )
        expect(ERROR_I18N_KEYS.VALIDATION_REQUIRED_FIELD).toBe(
            'errors.validation.required_field',
        )
    })

    test('has authentication error keys', () => {
        expect(ERROR_I18N_KEYS.AUTH_GENERIC).toBe('errors.auth.generic')
        expect(ERROR_I18N_KEYS.AUTH_BIOMETRIC_FAILED).toBe(
            'errors.auth.biometric_failed',
        )
        expect(ERROR_I18N_KEYS.AUTH_PIN_INCORRECT).toBe(
            'errors.auth.pin_incorrect',
        )
    })

    test('has storage error keys', () => {
        expect(ERROR_I18N_KEYS.STORAGE_GENERIC).toBe('errors.storage.generic')
        expect(ERROR_I18N_KEYS.STORAGE_READ_FAILED).toBe(
            'errors.storage.read_failed',
        )
        expect(ERROR_I18N_KEYS.STORAGE_WRITE_FAILED).toBe(
            'errors.storage.write_failed',
        )
    })

    test('has unknown error key', () => {
        expect(ERROR_I18N_KEYS.UNKNOWN).toBe('errors.unknown')
    })

    test('has WalletConnect error keys', () => {
        expect(ERROR_I18N_KEYS.WALLETCONNECT_INVALID_SESSION).toBe(
            'errors.walletconnect.invalid_session',
        )
        expect(ERROR_I18N_KEYS.WALLETCONNECT_SIGN_REQUEST).toBe(
            'errors.walletconnect.sign_request',
        )
        expect(ERROR_I18N_KEYS.WALLETCONNECT_PERMISSION).toBe(
            'errors.walletconnect.permission',
        )
        expect(ERROR_I18N_KEYS.WALLETCONNECT_INVALID_NETWORK).toBe(
            'errors.walletconnect.invalid_network',
        )
    })
})

describe('getAllErrorKeys', () => {
    test('returns all error keys as array', () => {
        const keys = getAllErrorKeys()

        expect(Array.isArray(keys)).toBe(true)
        expect(keys.length).toBeGreaterThan(0)
    })

    test('includes all defined error keys', () => {
        const keys = getAllErrorKeys()

        expect(keys).toContain(ERROR_I18N_KEYS.NETWORK_GENERIC)
        expect(keys).toContain(ERROR_I18N_KEYS.API_NOT_FOUND)
        expect(keys).toContain(ERROR_I18N_KEYS.VALIDATION_INVALID_ADDRESS)
        expect(keys).toContain(ERROR_I18N_KEYS.UNKNOWN)
    })

    test('returns correct number of keys', () => {
        const keys = getAllErrorKeys()
        const keyCount = Object.keys(ERROR_I18N_KEYS).length

        expect(keys.length).toBe(keyCount)
    })

    test('returns unique keys', () => {
        const keys = getAllErrorKeys()
        const uniqueKeys = [...new Set(keys)]

        expect(keys.length).toBe(uniqueKeys.length)
    })
})
