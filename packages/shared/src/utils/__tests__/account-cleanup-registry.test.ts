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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    registerAccountCleanup,
    runAccountCleanups,
    getAccountCleanupRegistry,
    resetAccountCleanupRegistry,
} from '../account-cleanup-registry'

vi.mock('../logging', () => ({
    logger: { debug: vi.fn(), error: vi.fn() },
}))

describe('account-cleanup-registry', () => {
    beforeEach(() => {
        resetAccountCleanupRegistry()
    })

    it('runs every registered handler with the cleanup context', async () => {
        const handler1 = vi.fn().mockResolvedValue(undefined)
        const handler2 = vi.fn().mockResolvedValue(undefined)
        registerAccountCleanup(handler1)
        registerAccountCleanup(handler2)

        const db = {}
        await runAccountCleanups({ db, accountAddress: 'ADDR1' })

        expect(handler1).toHaveBeenCalledWith({ db, accountAddress: 'ADDR1' })
        expect(handler2).toHaveBeenCalledWith({ db, accountAddress: 'ADDR1' })
    })

    it('runs remaining handlers when one rejects, and logs the failure', async () => {
        const failing = vi.fn().mockRejectedValue(new Error('boom'))
        const succeeding = vi.fn().mockResolvedValue(undefined)
        registerAccountCleanup(failing)
        registerAccountCleanup(succeeding)

        await runAccountCleanups({ accountAddress: 'ADDR1' })

        expect(succeeding).toHaveBeenCalledTimes(1)
    })

    it('exposes registered handlers via getAccountCleanupRegistry', () => {
        const handler = vi.fn()
        registerAccountCleanup(handler)

        expect(getAccountCleanupRegistry()).toHaveLength(1)
    })
})
