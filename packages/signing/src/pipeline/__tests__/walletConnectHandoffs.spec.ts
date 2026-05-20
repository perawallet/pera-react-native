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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from '../walletConnectHandoffs'

const buildHandoff = (
    overrides: Partial<PendingWalletConnectHandoff> = {},
): PendingWalletConnectHandoff => ({
    signRequestId: 'sr-1',
    multisigAddress: 'MSIG_ADDR',
    msigMetadata: {
        version: 1,
        threshold: 2,
        addresses: ['A1', 'A2', 'A3'],
    },
    deviceId: 'device-1',
    callbacks: {
        approveSignedBytes: vi.fn(),
        error: vi.fn(),
        softReject: vi.fn(),
    },
    source: { type: 'walletconnect' },
    registeredAt: Date.now(),
    ...overrides,
})

describe('walletConnectHandoffs', () => {
    beforeEach(() => {
        walletConnectHandoffs.__resetForTests()
    })

    test('register + get round-trips a handoff by signRequestId', () => {
        const h = buildHandoff()
        walletConnectHandoffs.register(h)
        expect(walletConnectHandoffs.get('sr-1')).toBe(h)
    })

    test('list returns all currently-registered handoffs', () => {
        walletConnectHandoffs.register(buildHandoff({ signRequestId: 'a' }))
        walletConnectHandoffs.register(buildHandoff({ signRequestId: 'b' }))
        const ids = walletConnectHandoffs
            .list()
            .map(h => h.signRequestId)
            .sort()
        expect(ids).toEqual(['a', 'b'])
    })

    test('unregister drops the entry', () => {
        walletConnectHandoffs.register(buildHandoff())
        walletConnectHandoffs.unregister('sr-1')
        expect(walletConnectHandoffs.get('sr-1')).toBeUndefined()
        expect(walletConnectHandoffs.list()).toEqual([])
    })

    test('re-registering with the same id replaces the entry', () => {
        const first = buildHandoff()
        const second = buildHandoff({ deviceId: 'device-2' })
        walletConnectHandoffs.register(first)
        walletConnectHandoffs.register(second)
        expect(walletConnectHandoffs.get('sr-1')).toBe(second)
        expect(walletConnectHandoffs.list()).toHaveLength(1)
    })

    test('subscribe fires on register and unregister; unsubscribe stops it', () => {
        const cb = vi.fn()
        const unsub = walletConnectHandoffs.subscribe(cb)

        walletConnectHandoffs.register(buildHandoff())
        expect(cb).toHaveBeenCalledTimes(1)

        walletConnectHandoffs.unregister('sr-1')
        expect(cb).toHaveBeenCalledTimes(2)

        unsub()
        walletConnectHandoffs.register(buildHandoff())
        expect(cb).toHaveBeenCalledTimes(2)
    })

    test('unregister of unknown id does not notify', () => {
        const cb = vi.fn()
        walletConnectHandoffs.subscribe(cb)
        walletConnectHandoffs.unregister('does-not-exist')
        expect(cb).not.toHaveBeenCalled()
    })

    test('subscriber throws do not break further notifications', () => {
        const failing = vi.fn().mockImplementation(() => {
            throw new Error('boom')
        })
        const ok = vi.fn()
        walletConnectHandoffs.subscribe(failing)
        walletConnectHandoffs.subscribe(ok)

        walletConnectHandoffs.register(buildHandoff())
        expect(failing).toHaveBeenCalled()
        expect(ok).toHaveBeenCalled()
    })

    test('__resetForTests clears handoffs AND subscribers', () => {
        const cb = vi.fn()
        walletConnectHandoffs.subscribe(cb)
        walletConnectHandoffs.register(buildHandoff())
        walletConnectHandoffs.__resetForTests()

        expect(walletConnectHandoffs.list()).toEqual([])
        // Reset clears subscribers too, so further changes don't notify.
        walletConnectHandoffs.register(buildHandoff())
        expect(cb).toHaveBeenCalledTimes(1) // Only from the first register
    })
})
