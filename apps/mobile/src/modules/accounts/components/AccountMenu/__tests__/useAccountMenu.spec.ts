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
const mockCardState = vi.hoisted(() => ({
    isAuthenticated: false as boolean,
    connectedFundingSourceAddress: null as string | null,
}))
const mockPeraCardFlag = vi.hoisted(() => ({ enabled: true }))

vi.mock('@hooks/useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: () => mockPeraCardFlag.enabled,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [ACCT_A, ACCT_B],
    useAccountValueTotalsQuery: () => ({ accountValueTotals: new Map() }),
    useSortedAccounts: (accounts: unknown[]) => ({
        sortedAccounts: accounts,
        sortMode: 'manual',
    }),
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: mockState.globalSelected,
        setSelectedAccountAddress: mockSetSelected,
    }),
}))

vi.mock('@perawallet/wallet-core-card', () => ({
    useCardSession: () => ({ isAuthenticated: mockCardState.isAuthenticated }),
    useCardStore: (
        selector: (state: {
            connectedFundingSourceAddress: string | null
        }) => unknown,
    ) =>
        selector({
            connectedFundingSourceAddress:
                mockCardState.connectedFundingSourceAddress,
        }),
}))

import { useAccountMenu } from '../useAccountMenu'

const baseProps = () => ({
    onSelected: vi.fn(),
    onAddAccount: vi.fn(),
    onOpenSort: vi.fn(),
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

describe('useAccountMenu pera card row', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockState.globalSelected = 'ADDR_A'
        mockCardState.isAuthenticated = false
        mockCardState.connectedFundingSourceAddress = null
        mockPeraCardFlag.enabled = true
    })

    it('omits the pera-card row when showPeraCardActivation is off', () => {
        const { result } = renderHook(() => useAccountMenu(baseProps()))

        expect(result.current.listItems).toHaveLength(2)
        expect(
            result.current.listItems.every(item => item.kind === 'account'),
        ).toBe(true)
    })

    it('inserts an un-activated row after the first account when not authenticated', () => {
        const { result } = renderHook(() =>
            useAccountMenu({ ...baseProps(), showPeraCardActivation: true }),
        )

        const items = result.current.listItems
        expect(items).toHaveLength(3)
        expect(items[0]).toEqual({ kind: 'account', account: ACCT_A })
        expect(items[1]).toEqual({
            kind: 'pera-card',
            activated: false,
            nested: false,
        })
        expect(items[2]).toEqual({ kind: 'account', account: ACCT_B })
    })

    it('nests an activated row after the connected account', () => {
        mockCardState.isAuthenticated = true
        mockCardState.connectedFundingSourceAddress = 'ADDR_B'

        const { result } = renderHook(() =>
            useAccountMenu({ ...baseProps(), showPeraCardActivation: true }),
        )

        const items = result.current.listItems
        expect(items).toHaveLength(3)
        expect(items[1]).toEqual({ kind: 'account', account: ACCT_B })
        expect(items[2]).toEqual({
            kind: 'pera-card',
            activated: true,
            nested: true,
        })
    })

    it('shows an activated-but-not-nested row after the first account when authenticated with no connected account', () => {
        mockCardState.isAuthenticated = true
        mockCardState.connectedFundingSourceAddress = null

        const { result } = renderHook(() =>
            useAccountMenu({ ...baseProps(), showPeraCardActivation: true }),
        )

        const items = result.current.listItems
        expect(items).toHaveLength(3)
        // Activated (the wallet has a card) but not nested — no real account to
        // connect under, so no connector is drawn.
        expect(items[1]).toEqual({
            kind: 'pera-card',
            activated: true,
            nested: false,
        })
    })

    it('does not nest when the connected address is not among the listed accounts', () => {
        mockCardState.isAuthenticated = true
        mockCardState.connectedFundingSourceAddress = 'ADDR_NOT_IN_LIST'

        const { result } = renderHook(() =>
            useAccountMenu({ ...baseProps(), showPeraCardActivation: true }),
        )

        const items = result.current.listItems
        expect(items[1]).toEqual({
            kind: 'pera-card',
            activated: true,
            nested: false,
        })
    })

    it('omits the pera-card row when the feature flag is disabled', () => {
        mockPeraCardFlag.enabled = false

        const { result } = renderHook(() =>
            useAccountMenu({ ...baseProps(), showPeraCardActivation: true }),
        )

        expect(result.current.listItems).toHaveLength(2)
        expect(
            result.current.listItems.every(item => item.kind === 'account'),
        ).toBe(true)
    })
})
