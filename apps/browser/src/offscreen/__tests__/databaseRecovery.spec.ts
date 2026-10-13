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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SqlStatementTimeoutError } from '@perawallet/wallet-extension-platform-chrome'

const { resetState } = vi.hoisted(() => ({ resetState: vi.fn() }))

vi.mock('@perawallet/wallet-core-background', () => ({
    useSyncCursorStore: { getState: () => ({ resetState }) },
}))

import { createDatabaseRecovery } from '../databaseRecovery'

describe('createDatabaseRecovery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('recovers from the worker statement timeout, as drizzle wraps it', () => {
        const recovery = createDatabaseRecovery(vi.fn())
        const wrapped = new Error('Failed query: UPDATE transactions', {
            cause: new SqlStatementTimeoutError(30_000),
        })

        expect(recovery.isRecoverable(wrapped)).toBe(true)
    })

    it('lets any other failure through', () => {
        const recovery = createDatabaseRecovery(vi.fn())

        expect(recovery.isRecoverable(new Error('syntax error'))).toBe(false)
    })

    it('drops the sync cursors so the next tick resyncs, then notifies', async () => {
        const onReset = vi.fn().mockResolvedValue(undefined)
        const recovery = createDatabaseRecovery(onReset)

        await recovery.onReset('0008_scope_key_network')

        expect(resetState).toHaveBeenCalledOnce()
        expect(onReset).toHaveBeenCalledOnce()
        expect(resetState.mock.invocationCallOrder[0]).toBeLessThan(
            onReset.mock.invocationCallOrder[0],
        )
    })
})
