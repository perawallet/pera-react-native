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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from '../walletConnectHandoffs'
import { useWalletConnectHandoffsStore } from '../../store/walletConnectHandoffsStore'

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
    expectedRawTransactionsBase64: [btoa('raw-tx-1')],
    deviceId: 'device-1',
    network: 'testnet',
    callbacks: {
        approveSignedBytes: vi.fn(),
        error: vi.fn(),
        reject: vi.fn(),
    },
    sourceType: 'walletconnect',
    registeredAt: Date.now(),
    ...overrides,
})

describe('walletConnectHandoffs wrapper', () => {
    beforeEach(() => {
        useWalletConnectHandoffsStore.getState().resetState()
    })

    test('register + get round-trips a handoff by signRequestId', () => {
        const h = buildHandoff()
        walletConnectHandoffs.register(h)
        expect(walletConnectHandoffs.get('sr-1')).toBe(h)
    })

    test('unregister drops the entry', () => {
        walletConnectHandoffs.register(buildHandoff())
        walletConnectHandoffs.unregister('sr-1')
        expect(walletConnectHandoffs.get('sr-1')).toBeUndefined()
    })

    test('re-registering with the same id replaces the entry', () => {
        const first = buildHandoff()
        const second = buildHandoff({ deviceId: 'device-2' })
        walletConnectHandoffs.register(first)
        walletConnectHandoffs.register(second)
        expect(walletConnectHandoffs.get('sr-1')).toBe(second)
        expect(
            Object.keys(useWalletConnectHandoffsStore.getState().handoffs),
        ).toHaveLength(1)
    })

    test('__resetForTests clears the store', () => {
        walletConnectHandoffs.register(buildHandoff())
        walletConnectHandoffs.__resetForTests()
        expect(useWalletConnectHandoffsStore.getState().handoffs).toEqual({})
    })
})

describe('useWalletConnectHandoffsStore', () => {
    beforeEach(() => {
        useWalletConnectHandoffsStore.getState().resetState()
    })

    test('subscribe fires on every register / unregister edge', () => {
        const cb = vi.fn()
        const unsub = useWalletConnectHandoffsStore.subscribe(cb)

        useWalletConnectHandoffsStore.getState().register(buildHandoff())
        expect(cb).toHaveBeenCalledTimes(1)

        useWalletConnectHandoffsStore.getState().unregister('sr-1')
        expect(cb).toHaveBeenCalledTimes(2)

        unsub()
        useWalletConnectHandoffsStore.getState().register(buildHandoff())
        expect(cb).toHaveBeenCalledTimes(2)
    })

    test('unregister of an unknown id is a no-op', () => {
        const cb = vi.fn()
        useWalletConnectHandoffsStore.subscribe(cb)
        useWalletConnectHandoffsStore.getState().unregister('does-not-exist')
        expect(cb).not.toHaveBeenCalled()
    })

    test('register replaces a same-id entry without growing the dict', () => {
        const first = buildHandoff()
        const second = buildHandoff({ deviceId: 'device-2' })
        useWalletConnectHandoffsStore.getState().register(first)
        useWalletConnectHandoffsStore.getState().register(second)
        const dict = useWalletConnectHandoffsStore.getState().handoffs
        expect(Object.keys(dict)).toEqual(['sr-1'])
        expect(dict['sr-1']).toBe(second)
    })

    test('resetState clears every entry', () => {
        useWalletConnectHandoffsStore.getState().register(buildHandoff())
        useWalletConnectHandoffsStore.getState().resetState()
        expect(useWalletConnectHandoffsStore.getState().handoffs).toEqual({})
    })
})
