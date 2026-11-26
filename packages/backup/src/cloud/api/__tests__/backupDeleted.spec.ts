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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { FromSeqTooOldError } from '../endpoints'
import { isBackupDeletedError } from '../backupDeleted'

const networkError = (status: number, backendCode?: string) =>
    new PeraNetworkError('client', { status, backendCode })

describe('isBackupDeletedError', () => {
    it('matches a 410 that carries BACKUP_DELETED', () => {
        expect(isBackupDeletedError(networkError(410, 'BACKUP_DELETED'))).toBe(
            true,
        )
    })

    it.each([
        ['a 410 with no code', networkError(410)],
        ['a 410 for a pruned changelog', networkError(410, 'FROM_SEQ_TOO_OLD')],
        ['a 401 auth failure', networkError(401, 'AUTH_FAILED')],
        ['a 401 that carries the deleted code', networkError(401, 'BACKUP_DELETED')],
        ['a plain Error', new Error('boom')],
        ['a FromSeqTooOldError', new FromSeqTooOldError(3)],
        [
            'a plain object shaped like the error',
            { status: 410, backendCode: 'BACKUP_DELETED' },
        ],
    ])('does not match %s', (_label, error) => {
        expect(isBackupDeletedError(error)).toBe(false)
    })
})
