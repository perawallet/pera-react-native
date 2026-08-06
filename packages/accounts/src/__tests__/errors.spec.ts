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

import { describe, test, expect } from 'vitest'
import { AccountError, DuplicateAccountError, NoHDWalletError } from '../errors'

describe('account error copy', () => {
    test('NoHDWalletError declares its key and walletKeyId param', () => {
        const error = new NoHDWalletError('ABC')

        expect(error.metadata.messageKey).toBe('errors.account.no_hd_wallet')
        expect(error.metadata.params).toEqual({ walletKeyId: 'ABC' })
    })

    test('AccountError defaults to the generic account key', () => {
        const error = new AccountError('some internal detail')

        expect(error.metadata.messageKey).toBe('errors.account.generic')
    })

    test('DuplicateAccountError surfaces generic account copy', () => {
        const error = new DuplicateAccountError('ABC')

        expect(error.metadata.messageKey).toBe('errors.account.generic')
        expect(error.metadata.params).toEqual({ address: 'ABC' })
    })
})
