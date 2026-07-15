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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    usePendingAccountCreationStore,
    setPendingAccountRollback,
    clearPendingAccountRollback,
    consumePendingAccountRollback,
} from '../pendingAccountCreation'

const getRollback = () =>
    usePendingAccountCreationStore.getState().pendingRollback

beforeEach(() => {
    usePendingAccountCreationStore.getState().resetState()
})

describe('setPendingAccountRollback', () => {
    it('stores the rollback callback', () => {
        const rollback = vi.fn(async () => {})
        setPendingAccountRollback(rollback)
        expect(getRollback()).toBe(rollback)
    })

    it('runs the previous rollback when replaced by a different one', () => {
        const first = vi.fn(async () => {})
        const second = vi.fn(async () => {})

        setPendingAccountRollback(first)
        setPendingAccountRollback(second)

        expect(first).toHaveBeenCalledTimes(1)
        expect(getRollback()).toBe(second)
    })

    it('does not re-run when the same rollback is set again', () => {
        const rollback = vi.fn(async () => {})
        setPendingAccountRollback(rollback)
        setPendingAccountRollback(rollback)

        expect(rollback).not.toHaveBeenCalled()
        expect(getRollback()).toBe(rollback)
    })
})

describe('clearPendingAccountRollback', () => {
    it('drops the pending rollback without invoking it', () => {
        const rollback = vi.fn(async () => {})
        setPendingAccountRollback(rollback)

        clearPendingAccountRollback()

        expect(rollback).not.toHaveBeenCalled()
        expect(getRollback()).toBeNull()
    })
})

describe('consumePendingAccountRollback', () => {
    it('invokes and clears the pending rollback', async () => {
        const rollback = vi.fn(async () => {})
        setPendingAccountRollback(rollback)

        await consumePendingAccountRollback()

        expect(rollback).toHaveBeenCalledTimes(1)
        expect(getRollback()).toBeNull()
    })

    it('resolves without error when there is nothing to roll back', async () => {
        await expect(consumePendingAccountRollback()).resolves.toBeUndefined()
        expect(getRollback()).toBeNull()
    })
})

describe('resetState', () => {
    it('clears the pending rollback and is idempotent', () => {
        setPendingAccountRollback(vi.fn(async () => {}))

        usePendingAccountCreationStore.getState().resetState()
        usePendingAccountCreationStore.getState().resetState()

        expect(getRollback()).toBeNull()
    })
})
