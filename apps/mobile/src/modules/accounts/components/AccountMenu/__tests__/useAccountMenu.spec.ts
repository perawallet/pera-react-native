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

import { renderHook, act } from '@test-utils/render'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// Mutable global-selection state + fixtures must be hoisted so the vi.mock
// factory (hoisted above imports) can reference them safely.
const mockState = vi.hoisted(() => ({
    globalSelected: 'ADDR_A' as string | null,
}))
const { mockSetSelected, ACCT_A, ACCT_B } = vi.hoisted(() => ({
    mockSetSelected: vi.fn(),
    ACCT_A: { address: 'ADDR_A', type: 'hdWallet' },
    ACCT_B: { address: 'ADDR_B', type: 'hdWallet' },
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [ACCT_A, ACCT_B],
    useAccountBalancesQuery: () => ({ accountBalances: new Map() }),
    useSortedAccounts: (accounts: unknown[]) => ({
        sortedAccounts: accounts,
        sortMode: 'manual',
    }),
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: mockState.globalSelected,
        setSelectedAccountAddress: mockSetSelected,
    }),
}))

import { resolveChartCollapsed, useAccountMenu } from '../useAccountMenu'

const baseProps = () => ({
    onSelected: vi.fn(),
    onAddAccount: vi.fn(),
    onOpenSort: vi.fn(),
})

describe('resolveChartCollapsed', () => {
    it('collapses once scrolled past the collapse offset', () => {
        expect(resolveChartCollapsed(false, 49)).toBe(true)
    })

    it('stays expanded for small scrolls within the threshold', () => {
        expect(resolveChartCollapsed(false, 48)).toBe(false)
        expect(resolveChartCollapsed(false, 10)).toBe(false)
    })

    it('stays collapsed while scrolling within the hysteresis band', () => {
        expect(resolveChartCollapsed(true, 40)).toBe(true)
        expect(resolveChartCollapsed(true, 8)).toBe(true)
    })

    it('re-expands only once scrolled back near the top', () => {
        expect(resolveChartCollapsed(true, 7)).toBe(false)
        expect(resolveChartCollapsed(true, 0)).toBe(false)
    })
})

describe('useAccountMenu selection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.globalSelected = 'ADDR_A'
    })

    it('uncontrolled: highlights the global selected account', () => {
        const { result } = renderHook(() => useAccountMenu(baseProps()))

        expect(result.current.selectedAccountAddress).toBe('ADDR_A')
    })

    it('uncontrolled: tapping mutates the global selection and notifies', () => {
        const props = baseProps()
        const { result } = renderHook(() => useAccountMenu(props))

        act(() => result.current.handleTap(ACCT_B as WalletAccount))

        expect(mockSetSelected).toHaveBeenCalledWith('ADDR_B')
        expect(props.onSelected).toHaveBeenCalledWith(ACCT_B)
    })

    it('controlled: highlights the passed address, not the global one', () => {
        const { result } = renderHook(() =>
            useAccountMenu({ ...baseProps(), selectedAddress: 'ADDR_B' }),
        )

        expect(result.current.selectedAccountAddress).toBe('ADDR_B')
    })

    it('controlled with null: highlights nothing (fresh pick)', () => {
        const { result } = renderHook(() =>
            useAccountMenu({ ...baseProps(), selectedAddress: null }),
        )

        expect(result.current.selectedAccountAddress).toBeNull()
    })

    it('controlled: tapping notifies but does NOT mutate the global selection', () => {
        const props = { ...baseProps(), selectedAddress: null }
        const { result } = renderHook(() => useAccountMenu(props))

        act(() => result.current.handleTap(ACCT_B as WalletAccount))

        expect(mockSetSelected).not.toHaveBeenCalled()
        expect(props.onSelected).toHaveBeenCalledWith(ACCT_B)
    })
})
