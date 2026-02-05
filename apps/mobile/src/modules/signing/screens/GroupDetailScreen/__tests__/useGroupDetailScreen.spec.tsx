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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGroupDetailScreen } from '../useGroupDetailScreen'

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()
const mockRouteParams = { groupIndex: 0 }

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
        goBack: mockGoBack,
    }),
    useRoute: () => ({
        params: mockRouteParams,
    }),
}))

const mockTx1 = { id: 'tx-1', sender: 'ADDR1' }
const mockTx2 = { id: 'tx-2', sender: 'ADDR1' }

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: vi.fn(() => ({
        pendingSignRequests: [{ id: 'req-1', type: 'transactions' }],
    })),
    useSigningRequestAnalysis: vi.fn(() => ({
        listItems: [
            { type: 'transaction', transaction: { id: 'tx-0' } },
            {
                type: 'group',
                transactions: [mockTx1, mockTx2],
                groupIndex: 0,
            },
            {
                type: 'group',
                transactions: [{ id: 'tx-3' }],
                groupIndex: 1,
            },
        ],
    })),
}))

describe('useGroupDetailScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams.groupIndex = 0
    })

    it('returns transactions for the specified group index', () => {
        const { result } = renderHook(() => useGroupDetailScreen())

        expect(result.current.transactions).toHaveLength(2)
        expect(result.current.transactions[0]?.id).toBe('tx-1')
        expect(result.current.transactions[1]?.id).toBe('tx-2')
    })

    it('returns empty array when group is not found', () => {
        mockRouteParams.groupIndex = 999

        const { result } = renderHook(() => useGroupDetailScreen())

        expect(result.current.transactions).toEqual([])
    })

    it('navigates to TransactionDetails on transaction press', () => {
        const { result } = renderHook(() => useGroupDetailScreen())

        result.current.handleTransactionPress(mockTx1 as any)

        expect(mockNavigate).toHaveBeenCalledWith('TransactionDetails', {
            transaction: mockTx1,
        })
    })

    it('calls goBack on handleBack', () => {
        const { result } = renderHook(() => useGroupDetailScreen())

        result.current.handleBack()

        expect(mockGoBack).toHaveBeenCalled()
    })

    it('generates correct key for transaction with id', () => {
        const { result } = renderHook(() => useGroupDetailScreen())

        const key = result.current.keyExtractor({ id: 'tx-123' } as any, 0)

        expect(key).toBe('tx-123')
    })

    it('generates fallback key for transaction without id', () => {
        const { result } = renderHook(() => useGroupDetailScreen())

        const key = result.current.keyExtractor({} as any, 5)

        expect(key).toBe('tx-5')
    })

    it('finds correct group when multiple groups exist', () => {
        mockRouteParams.groupIndex = 1

        const { result } = renderHook(() => useGroupDetailScreen())

        expect(result.current.transactions).toHaveLength(1)
        expect(result.current.transactions[0]?.id).toBe('tx-3')
    })
})
