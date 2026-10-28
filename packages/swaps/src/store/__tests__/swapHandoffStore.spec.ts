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

// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Stores register once, at import, and vitest clears mock calls before every
// test, so registrations are kept here rather than on a vi.fn().
const registeredStores = vi.hoisted(
    () =>
        [] as Parameters<
            typeof import('@perawallet/wallet-core-shared').registerStore
        >[0][],
)

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: (entry: (typeof registeredStores)[number]) => {
            registeredStores.push(entry)
        },
    }
})

import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    migrateSwapHandoffState,
    useSwapHandoffStore,
} from '../swapHandoffStore'
import type { SwapHandoffRecord } from '../../models'

const makeRecord = (
    overrides: Partial<SwapHandoffRecord> = {},
): SwapHandoffRecord => ({
    swapIdStr: '42',
    signRequestId: 'req-1',
    scope: { chainId: 'algorand', networkId: 'mainnet' },
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
        const registration = registeredStores.at(-1)!

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

    test('replays a pending v1 testnet handoff under the Algorand testnet scope', async () => {
        const persisted = JSON.stringify({
            state: {
                handoffs: {
                    'req-9': {
                        swapIdStr: '90071992547409931',
                        signRequestId: 'req-9',
                        network: 'testnet',
                        multisigAddress: 'JOINT_ADDR',
                        deviceId: 'device-9',
                        msigMetadata: {
                            version: 1,
                            threshold: 2,
                            addresses: ['A', 'B'],
                        },
                        plan: [
                            {
                                slots: [
                                    {
                                        kind: 'preSigned',
                                        signedTxnBase64: 'cHJlc2lnbmVk',
                                    },
                                    { kind: 'toSign', flatIndex: 0 },
                                ],
                            },
                        ],
                        expectedRawTransactionsBase64: ['cmF3'],
                        registeredAt: 1700000000000,
                        submission: {
                            txIds: ['TX1'],
                            submittedAt: 1700000001000,
                        },
                    },
                },
            },
            version: 1,
        })
        getProvider().keyValueStorage.setItem('swap-handoff-store', persisted)

        await useSwapHandoffStore.persist.rehydrate()

        const { network: _network, ...rest } =
            JSON.parse(persisted).state.handoffs['req-9']
        expect(useSwapHandoffStore.getState().handoffs).toEqual({
            'req-9': {
                ...rest,
                scope: { chainId: 'algorand', networkId: 'testnet' },
            },
        })
    })
})

describe('migrateSwapHandoffState', () => {
    const v1Record = (signRequestId: string, network: string) => {
        const { scope: _scope, ...rest } = makeRecord({ signRequestId })
        return { ...rest, network }
    }

    test('moves a v1 network onto the Algorand scope, other fields unchanged', () => {
        const migrated = migrateSwapHandoffState(
            { handoffs: { 'req-1': v1Record('req-1', 'mainnet') } },
            1,
        )

        expect(migrated.handoffs).toEqual({ 'req-1': makeRecord() })
    })

    test('drops a v1 record whose network this build does not know', () => {
        const migrated = migrateSwapHandoffState(
            {
                handoffs: {
                    'req-1': v1Record('req-1', 'mainnet'),
                    'req-2': v1Record('req-2', 'devnet'),
                },
            },
            1,
        )

        expect(Object.keys(migrated.handoffs)).toEqual(['req-1'])
    })

    test('leaves v2 state untouched', () => {
        const state = { handoffs: { 'req-1': makeRecord() } }

        expect(migrateSwapHandoffState(state, 2)).toEqual(state)
    })
})
