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

import { describe, expect, it } from 'vitest'
import {
    AppError,
    ErrorCategory,
    isExpectedError,
} from '@perawallet/wallet-core-shared'
import {
    InvalidPasswordError,
    PasskeyUnlockError,
    VaultCorruptedError,
    VaultExistsError,
    VaultLockedError,
    VaultLockedOutError,
    VaultNotInitializedError,
} from '../errors'

const rows: [string, () => AppError, ErrorCategory][] = [
    ['VaultLockedError', () => new VaultLockedError('m'), ErrorCategory.KMS],
    ['VaultExistsError', () => new VaultExistsError('m'), ErrorCategory.KMS],
    [
        'VaultNotInitializedError',
        () => new VaultNotInitializedError('m'),
        ErrorCategory.KMS,
    ],
    [
        'InvalidPasswordError',
        () => new InvalidPasswordError('m'),
        ErrorCategory.KMS,
    ],
    ['VaultCorruptedError', () => new VaultCorruptedError(), ErrorCategory.KMS],
    [
        'VaultLockedOutError',
        () => new VaultLockedOutError(30),
        ErrorCategory.KMS,
    ],
    ['PasskeyUnlockError', () => new PasskeyUnlockError(), ErrorCategory.KMS],
]

describe('keystore-chrome domain errors', () => {
    it.each(rows)('%s is a classified AppError', (name, make, category) => {
        const error = make()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(category)
        expect(isExpectedError(error)).toBe(false)
    })

    it('keeps the seconds left on a lockout', () => {
        expect(new VaultLockedOutError(30).remainingSeconds).toBe(30)
    })
})
