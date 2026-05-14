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

import { describe, test, expect, beforeEach } from 'vitest'
import { approvalGate } from '../approvalGate'

describe('approvalGate', () => {
    beforeEach(() => {
        approvalGate.__resetForTests()
    })

    describe('register', () => {
        test('is idempotent — registering twice keeps the same deferred', async () => {
            approvalGate.register('req-1')
            const first = approvalGate.waitFor('req-1')

            approvalGate.register('req-1')
            const second = approvalGate.waitFor('req-1')

            expect(first).toBe(second)

            approvalGate.approve('req-1')
            await expect(first).resolves.toBe('approved')
        })

        test('isRegistered reflects current map state', () => {
            expect(approvalGate.isRegistered('req-1')).toBe(false)
            approvalGate.register('req-1')
            expect(approvalGate.isRegistered('req-1')).toBe(true)
        })
    })

    describe('waitFor', () => {
        test('returns the gate promise when registered and pending', async () => {
            approvalGate.register('req-1')
            const result = approvalGate.waitFor('req-1')
            approvalGate.approve('req-1')
            await expect(result).resolves.toBe('approved')
        })

        test('returns the prior result when approve runs before waitFor', async () => {
            approvalGate.register('req-1')
            approvalGate.approve('req-1')
            // Simulates the lifecycle awaiting the gate *after* the user
            // already slid to confirm (e.g. analyzer finished slower than
            // the slide animation).
            await expect(approvalGate.waitFor('req-1')).resolves.toBe(
                'approved',
            )
        })

        test('returns the prior result when reject runs before waitFor', async () => {
            approvalGate.register('req-1')
            approvalGate.reject('req-1')
            // Critical case: user taps Cancel while the actor is still
            // validating. The lifecycle's `waitFor` runs when the actor
            // later enters `awaiting_user` and must observe the prior
            // rejection — otherwise the request would be silently signed.
            await expect(approvalGate.waitFor('req-1')).resolves.toBe(
                'rejected',
            )
        })

        test('returns approved synchronously when no gate is registered (headless fast-path)', async () => {
            await expect(approvalGate.waitFor('req-headless')).resolves.toBe(
                'approved',
            )
        })
    })

    describe('approve / reject', () => {
        test('no-ops when no gate is registered', () => {
            expect(() => approvalGate.approve('missing')).not.toThrow()
            expect(() => approvalGate.reject('missing')).not.toThrow()
        })

        test('second resolve call is a no-op (Promise resolves only once)', async () => {
            approvalGate.register('req-1')
            const result = approvalGate.waitFor('req-1')

            approvalGate.approve('req-1')
            approvalGate.reject('req-1')

            await expect(result).resolves.toBe('approved')
        })

        test('keeps the entry in the map so subsequent waitFor sees the result', async () => {
            approvalGate.register('req-1')
            approvalGate.approve('req-1')
            expect(approvalGate.isRegistered('req-1')).toBe(true)
            await expect(approvalGate.waitFor('req-1')).resolves.toBe(
                'approved',
            )
        })
    })

    describe('unregister', () => {
        test('drops the entry when not pending', () => {
            approvalGate.register('req-1')
            approvalGate.approve('req-1')
            approvalGate.unregister('req-1')
            expect(approvalGate.isRegistered('req-1')).toBe(false)
        })

        test("resolves a pending deferred with 'cancelled' so awaiters release their closure", async () => {
            approvalGate.register('req-1')
            const result = approvalGate.waitFor('req-1')
            approvalGate.unregister('req-1')
            await expect(result).resolves.toBe('cancelled')
            expect(approvalGate.isRegistered('req-1')).toBe(false)
        })

        test('is a no-op for missing entries', () => {
            expect(() => approvalGate.unregister('missing')).not.toThrow()
        })
    })

    describe('__resetForTests', () => {
        test('drops every gate', () => {
            approvalGate.register('req-1')
            approvalGate.register('req-2')
            approvalGate.__resetForTests()
            expect(approvalGate.isRegistered('req-1')).toBe(false)
            expect(approvalGate.isRegistered('req-2')).toBe(false)
        })
    })
})
