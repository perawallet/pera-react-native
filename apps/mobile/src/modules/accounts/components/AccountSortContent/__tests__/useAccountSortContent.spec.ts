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
import { renderHook, act } from '@test-utils/render'
import { useAccountSortContent } from '../useAccountSortContent'

const h = vi.hoisted(() => ({
    accounts: [{ address: 'addr1' }, { address: 'addr2' }],
    sortMode: 'alphabeticalAsc',
    setSortMode: vi.fn(),
    setManualAccountOrder: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    AccountSortModes: {
        alphabeticalAsc: 'alphabeticalAsc',
        alphabeticalDesc: 'alphabeticalDesc',
        balanceAsc: 'balanceAsc',
        balanceDesc: 'balanceDesc',
        manual: 'manual',
    },
    useAllAccounts: () => h.accounts,
    useAccountValueTotalsQuery: () => ({ accountValueTotals: new Map() }),
    useSortedAccounts: () => ({
        sortedAccounts: h.accounts,
        sortMode: h.sortMode,
        setSortMode: h.setSortMode,
        setManualAccountOrder: h.setManualAccountOrder,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

describe('useAccountSortContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        h.sortMode = 'alphabeticalAsc'
    })

    it('initialises the draft from the stored sort mode and order', () => {
        const { result } = renderHook(() => useAccountSortContent())

        expect(result.current.sortMode).toBe('alphabeticalAsc')
        expect(result.current.sortedAccounts.map(a => a.address)).toEqual([
            'addr1',
            'addr2',
        ])
    })

    it('updates the draft without writing to the store on edit', () => {
        const { result } = renderHook(() => useAccountSortContent())

        act(() => result.current.handleSortModeChange('manual'))
        act(() => result.current.handleReorder(['addr2', 'addr1']))

        expect(result.current.sortMode).toBe('manual')
        expect(result.current.sortedAccounts.map(a => a.address)).toEqual([
            'addr2',
            'addr1',
        ])
        expect(h.setSortMode).not.toHaveBeenCalled()
        expect(h.setManualAccountOrder).not.toHaveBeenCalled()
    })

    it('commits the mode and reordered addresses on commit when manual', () => {
        const { result } = renderHook(() => useAccountSortContent())

        act(() => result.current.handleSortModeChange('manual'))
        act(() => result.current.handleReorder(['addr2', 'addr1']))
        act(() => result.current.commitChanges())

        expect(h.setSortMode).toHaveBeenCalledWith('manual')
        expect(h.setManualAccountOrder).toHaveBeenCalledWith(['addr2', 'addr1'])
    })

    it('commits only the mode (not the order) when not manual', () => {
        const { result } = renderHook(() => useAccountSortContent())

        act(() => result.current.handleSortModeChange('balanceDesc'))
        act(() => result.current.commitChanges())

        expect(h.setSortMode).toHaveBeenCalledWith('balanceDesc')
        expect(h.setManualAccountOrder).not.toHaveBeenCalled()
    })
})
