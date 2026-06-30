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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useSigningPipeline } from '../useSigningPipeline'
import { useGroupSimulationQuery } from '../useGroupSimulationQuery'
import { useImpactTransactions } from '../useImpactTransactions'

vi.mock('../useSigningPipeline', () => ({ useSigningPipeline: vi.fn() }))
vi.mock('../useGroupSimulationQuery', () => ({
    useGroupSimulationQuery: vi.fn(),
}))

const payment = { txType: 'pay' } as unknown as PeraDisplayableTransaction
const appCall = { txType: 'appl' } as unknown as PeraDisplayableTransaction
const innerTxn = {
    txType: 'pay',
    id: 'inner',
} as unknown as PeraDisplayableTransaction

const SIGNERS = new Set(['ADDR_A'])

const mockPipeline = (allTransactions: PeraDisplayableTransaction[]) => {
    vi.mocked(useSigningPipeline).mockReturnValue({
        allTransactions,
        signableAddresses: SIGNERS,
        currentRequest: { id: 'req-1', txs: allTransactions },
    } as unknown as ReturnType<typeof useSigningPipeline>)
}

const mockSimulation = (
    over: Partial<ReturnType<typeof useGroupSimulationQuery>> = {},
) => {
    vi.mocked(useGroupSimulationQuery).mockReturnValue({
        data: undefined,
        isFetching: false,
        isError: false,
        error: null,
        ...over,
    } as unknown as ReturnType<typeof useGroupSimulationQuery>)
}

describe('useImpactTransactions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSimulation()
    })

    test('returns the top-level group untouched and disables simulation without an app call', () => {
        mockPipeline([payment])

        const { result } = renderHook(() => useImpactTransactions())

        expect(result.current.transactions).toEqual([payment])
        expect(result.current.signableAddresses).toBe(SIGNERS)
        expect(result.current.isSimulating).toBe(false)
        expect(useGroupSimulationQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
    })

    test('enables simulation and appends inner transactions when the group has an app call', () => {
        mockPipeline([appCall])
        mockSimulation({ data: [innerTxn] })

        const { result } = renderHook(() => useImpactTransactions())

        expect(useGroupSimulationQuery).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: true }),
        )
        expect(result.current.transactions).toEqual([appCall, innerTxn])
    })

    test('flags isSimulating while an app-call group is still fetching', () => {
        mockPipeline([appCall])
        mockSimulation({ isFetching: true })

        const { result } = renderHook(() => useImpactTransactions())

        expect(result.current.isSimulating).toBe(true)
    })

    test('flags simulationFailed when an app-call group simulation errors', () => {
        mockPipeline([appCall])
        mockSimulation({ isError: true, error: new Error('simulate failed') })

        const { result } = renderHook(() => useImpactTransactions())

        expect(result.current.simulationFailed).toBe(true)
    })

    test('does not flag simulationFailed without an app call', () => {
        mockPipeline([payment])
        mockSimulation({ isError: true })

        const { result } = renderHook(() => useImpactTransactions())

        expect(result.current.simulationFailed).toBe(false)
    })
})
