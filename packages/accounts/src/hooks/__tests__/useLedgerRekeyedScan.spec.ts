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
import { renderHook } from '@testing-library/react'
import { useLedgerRekeyedScan } from '../useLedgerRekeyedScan'

const mocks = vi.hoisted(() => ({
    useQueries: vi.fn(),
    useNetwork: vi.fn(),
    useAllAccounts: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({ useQueries: mocks.useQueries }))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))
vi.mock('../useAllAccounts', () => ({ useAllAccounts: mocks.useAllAccounts }))

const derived = (address: string, accountIndex: number) => ({
    address,
    publicKey: new Uint8Array([accountIndex]),
    accountIndex,
})

beforeEach(() => {
    vi.clearAllMocks()
    mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
    mocks.useAllAccounts.mockReturnValue([])
})

describe('useLedgerRekeyedScan', () => {
    it('maps rekeyed addresses to entries attributed to the scanned derived account', () => {
        const d0 = derived('LEDGER0', 0)
        mocks.useQueries.mockReturnValue([
            { data: ['REKEYED_A', 'REKEYED_B'], isPending: false },
        ])

        const { result } = renderHook(() => useLedgerRekeyedScan([d0]))

        expect(result.current.isScanning).toBe(false)
        expect(result.current.rekeyed).toEqual([
            { kind: 'rekeyed', address: 'REKEYED_A', authAccount: d0 },
            { kind: 'rekeyed', address: 'REKEYED_B', authAccount: d0 },
        ])
    })

    it('dedupes vs derived addresses, already-imported addresses, and repeats', () => {
        const d0 = derived('LEDGER0', 0)
        const d1 = derived('LEDGER1', 1)
        mocks.useAllAccounts.mockReturnValue([{ address: 'IMPORTED' }])
        mocks.useQueries.mockReturnValue([
            { data: ['REKEYED_A', 'LEDGER1', 'IMPORTED'], isPending: false },
            { data: ['REKEYED_A', 'REKEYED_C'], isPending: false },
        ])

        const { result } = renderHook(() => useLedgerRekeyedScan([d0, d1]))

        expect(result.current.rekeyed).toEqual([
            { kind: 'rekeyed', address: 'REKEYED_A', authAccount: d0 },
            { kind: 'rekeyed', address: 'REKEYED_C', authAccount: d1 },
        ])
    })

    it('reports isScanning while any query is pending and tolerates missing data', () => {
        const d0 = derived('LEDGER0', 0)
        mocks.useQueries.mockReturnValue([{ data: undefined, isPending: true }])

        const { result } = renderHook(() => useLedgerRekeyedScan([d0]))

        expect(result.current.isScanning).toBe(true)
        expect(result.current.rekeyed).toEqual([])
    })

    it('returns empty and not scanning for no derived accounts', () => {
        mocks.useQueries.mockReturnValue([])
        const { result } = renderHook(() => useLedgerRekeyedScan([]))
        expect(result.current).toEqual({ rekeyed: [], isScanning: false })
    })
})
