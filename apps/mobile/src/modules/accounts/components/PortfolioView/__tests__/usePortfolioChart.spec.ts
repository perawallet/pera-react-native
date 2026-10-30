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
import { act, renderHook } from '@testing-library/react'
import type { PortfolioValueHistoryItem } from '@perawallet/wallet-core-accounts'
import { usePortfolioChart } from '../usePortfolioChart'

const mocks = vi.hoisted(() => ({ historyQuery: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-accounts')>()),
    useAccountBalancesHistoryQuery: mocks.historyQuery,
}))

const scope = { chainId: 'algorand', networkId: 'mainnet' } as never

describe('usePortfolioChart', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.historyQuery.mockReturnValue({ data: [] })
    })

    it('reports the scrubbed point through the selection handler', () => {
        const setSelectedPoint = vi.fn()
        const onDataSelected = vi.fn()
        const { result } = renderHook(() =>
            usePortfolioChart({
                chartSources: [],
                period: 'one-day',
                scope,
                isChartShown: true,
                basis: 'fiat',
                selectedPoint: null,
                setSelectedPoint,
                onDataSelected,
            }),
        )

        const point = { datetime: new Date('2024-01-01') } as PortfolioValueHistoryItem
        act(() => result.current.chartSelectionChanged(point))

        expect(setSelectedPoint).toHaveBeenCalledWith(point)
        expect(onDataSelected).toHaveBeenCalledWith(point)
    })
})
