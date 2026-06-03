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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { exportCardStatement } = vi.hoisted(() => ({
    exportCardStatement: vi.fn(),
}))
vi.mock('../../api/transactions', () => ({ exportCardStatement }))

import { useExportCardStatementMutation } from '../useExportCardStatementMutation'
import { StatementFormat } from '../../models'

describe('useExportCardStatementMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('exports a statement with the chosen format and network', async () => {
        const statement = { format: StatementFormat.Csv, blob: new Blob(['x']) }
        exportCardStatement.mockResolvedValue(statement)

        const { result } = renderHook(() => useExportCardStatementMutation(), {
            wrapper,
        })
        result.current.mutate({
            format: StatementFormat.Csv,
            filters: { dateFrom: '2026-01-01' },
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(exportCardStatement).toHaveBeenCalledWith({
            network: 'mainnet',
            format: StatementFormat.Csv,
            filters: { dateFrom: '2026-01-01' },
        })
        expect(result.current.data?.format).toBe(StatementFormat.Csv)
    })
})
