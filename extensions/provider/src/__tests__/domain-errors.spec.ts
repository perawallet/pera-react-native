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

import { describe, expect, it, vi } from 'vitest'
import {
    AppError,
    ErrorCategory,
    isExpectedError,
} from '@perawallet/wallet-core-shared'
import { KeystoreHydrationError } from '../singleton'

// The singleton builds the native keystore at import; only the error is under test.
vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    createReactNativeKeyStore: () => ({ ready: Promise.resolve() }),
    METADATA_PREFIX: 'k/',
    storage: { getAllKeys: () => [], getString: () => undefined },
}))

const rows: [string, () => AppError, ErrorCategory][] = [
    [
        'KeystoreHydrationError',
        () => new KeystoreHydrationError(['a'], new Error('bad record')),
        ErrorCategory.KMS,
    ],
]

describe('provider domain errors', () => {
    it.each(rows)('%s is a classified AppError', (name, make, category) => {
        const error = make()

        expect(error).toBeInstanceOf(AppError)
        expect(error.name).toBe(name)
        expect(error.metadata.category).toBe(category)
        expect(isExpectedError(error)).toBe(false)
    })

    it('keeps the failed ids and the cause it was built from', () => {
        const inner = new Error('bad record')

        const error = new KeystoreHydrationError(['a'], inner)

        expect(error.failedIds).toEqual(['a'])
        expect(error.cause).toBe(inner)
        expect(error.originalError).toBe(inner)
    })
})
