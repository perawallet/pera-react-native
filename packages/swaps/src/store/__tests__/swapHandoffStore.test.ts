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
import { renderHook, act } from '@testing-library/react'

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: registerStoreMock,
    }
})

import { useSwapHandoffStore } from '../swapHandoffStore'
import type { SwapHandoffRecord } from '../../models'

const makeRecord = (
    overrides: Partial<SwapHandoffRecord> = {},
): SwapHandoffRecord => ({
    swapIdStr: '42',
    signRequestId: 'req-1',
    network: 'mainnet',
    multisigAddress: 'JOINT_ADDR',
    deviceId: 'device-1',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B'] },
    plan: [
        {
            slots: [
                { kind: 'preSigned', signedTxnBase64: 'cHJlc2lnbmVk' },
                { kind: 'toSign', flatIndex: 0 },
            ],
        },
    ],
    expectedRawTransactionsBase64: ['cmF3'],
    registeredAt: 1,
    ...overrides,
})

describe('swaps/swapHandoffStore', () => {
    beforeEach(() => {
        useSwapHandoffStore.getState().resetState()
    })

    test('initializes with no handoffs', () => {
        const { result } = renderHook(() => useSwapHandoffStore())
        expect(result.current.handoffs).toEqual({})
    })

    test('registerHandoff stores the record keyed by signRequestId', () => {
        const { result } = renderHook(() => useSwapHandoffStore())
        const record = makeRecord()

        act(() => result.current.registerHandoff(record))

        expect(result.current.handoffs['req-1']).toEqual(record)
    })

    test('registerHandoff keeps records for distinct sign requests', () => {
        const { result } = renderHook(() => useSwapHandoffStore())

        act(() => {
            result.current.registerHandoff(makeRecord({ signRequestId: 'a' }))
            result.current.registerHandoff(makeRecord({ signRequestId: 'b' }))
        })

        expect(Object.keys(result.current.handoffs).sort()).toEqual(['a', 'b'])
    })

    test('markHandoffSubmitted stamps the submission marker on the record', () => {
        const { result } = renderHook(() => useSwapHandoffStore())

        act(() => {
            result.current.registerHandoff(makeRecord())
            result.current.markHandoffSubmitted('req-1', ['txid-1', 'txid-2'])
        })

        const record = result.current.handoffs['req-1']
        expect(record.submission?.txIds).toEqual(['txid-1', 'txid-2'])
        expect(record.submission?.submittedAt).toEqual(expect.any(Number))
        // The rest of the record is untouched.
        expect(record.swapIdStr).toBe('42')
    })

    test('markHandoffSubmitted is a no-op for an unknown sign request', () => {
        const { result } = renderHook(() => useSwapHandoffStore())

        act(() => {
            result.current.registerHandoff(makeRecord())
            result.current.markHandoffSubmitted('missing', ['txid-1'])
        })

        expect(result.current.handoffs['req-1'].submission).toBeUndefined()
        expect(Object.keys(result.current.handoffs)).toEqual(['req-1'])
    })

    test('removeHandoff drops only the targeted record', () => {
        const { result } = renderHook(() => useSwapHandoffStore())

        act(() => {
            result.current.registerHandoff(makeRecord({ signRequestId: 'a' }))
            result.current.registerHandoff(makeRecord({ signRequestId: 'b' }))
            result.current.removeHandoff('a')
        })

        expect(Object.keys(result.current.handoffs)).toEqual(['b'])
    })

    test('registers clearStorage + resetState hooks that drive the store', () => {
        const [registration] = registerStoreMock.mock.calls.at(-1) as [
            {
                name: string
                clearStorage: () => void
                resetState: () => void
            },
        ]

        expect(registration.name).toBe('swap-handoff-store')

        useSwapHandoffStore.getState().registerHandoff(makeRecord())
        registration.resetState()
        expect(useSwapHandoffStore.getState().handoffs).toEqual({})

        // clearStorage delegates to persist middleware — just prove it runs.
        expect(() => registration.clearStorage()).not.toThrow()
    })

    test('resetState clears all handoffs', () => {
        const { result } = renderHook(() => useSwapHandoffStore())

        act(() => {
            result.current.registerHandoff(makeRecord())
            result.current.resetState()
        })

        expect(result.current.handoffs).toEqual({})
    })
})
