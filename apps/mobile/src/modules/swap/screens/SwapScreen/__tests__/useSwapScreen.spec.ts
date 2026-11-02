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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { useSwapScreen } from '../useSwapScreen'

type Account = { id: string }

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const {
    routeParams,
    mockSetFromAsset,
    mockSetToAsset,
    mockSetSelectedAccountId,
    mockRequestBottomSheet,
    mockPushWebView,
    mockMarkIntroductionSeen,
    state,
} = vi.hoisted(() => ({
    routeParams: { current: undefined as Record<string, string> | undefined },
    mockSetFromAsset: vi.fn(),
    mockSetToAsset: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    mockPushWebView: vi.fn(),
    mockMarkIntroductionSeen: vi.fn(),
    state: {
        selected: null as Account | null,
        signers: [] as Account[],
        swapChainAccounts: new Set<string>(),
        isIntroductionSeen: false,
    },
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeParams.current }),
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapsStore: (
        selector: (store: {
            setFromAsset: typeof mockSetFromAsset
            setToAsset: typeof mockSetToAsset
        }) => unknown,
    ) =>
        selector({
            setFromAsset: mockSetFromAsset,
            setToAsset: mockSetToAsset,
        }),
    useSwapScope: (account: Account | null) =>
        account && state.swapChainAccounts.has(account.id) ? SCOPE : null,
    useSwapSigningAccounts: () => state.signers,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => state.selected,
    useSelectedAccountId: () => ({
        setSelectedAccountId: mockSetSelectedAccountId,
    }),
}))

vi.mock('@modules/accounts', () => ({
    useAccountListPicker: (accounts: Account[]) => ({
        accountFilter: (account: Account) =>
            accounts.some(candidate => candidate.id === account.id),
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: () => ({ assetId: '0' }),
    getKnownAssetId: () => '31566704',
}))

vi.mock('../useSeedSwapRouteAssets', () => ({
    useSeedSwapRouteAssets: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@modules/swap/hooks', () => ({
    useSwapIntroduction: () => ({
        isIntroductionSeen: state.isIntroductionSeen,
        markIntroductionSeen: mockMarkIntroductionSeen,
    }),
}))

vi.mock('@modules/swap/components', () => ({
    SwapIntroductionContent: () => null,
}))

describe('useSwapScreen', () => {
    beforeEach(() => {
        routeParams.current = undefined
        vi.clearAllMocks()
        state.selected = { id: 'acc-1' }
        state.signers = [{ id: 'acc-1' }]
        state.swapChainAccounts = new Set(['acc-1', 'acc-2'])
        state.isIntroductionSeen = false
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it("swaps on the selected account's chain scope", () => {
        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.scope).toEqual(SCOPE)
    })

    it('has no scope when the selected account is on no swap chain', () => {
        state.selected = { id: 'eth-only' }
        state.signers = []

        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.scope).toBeNull()
        expect(mockSetFromAsset).not.toHaveBeenCalled()
    })

    it('offers only accounts that can sign on their swap chain', () => {
        state.signers = [{ id: 'acc-1' }, { id: 'acc-2' }]

        const { result } = renderHook(() => useSwapScreen())

        const { accountFilter } = result.current.accountPicker
        expect(accountFilter?.({ id: 'acc-1' } as never)).toBe(true)
        expect(accountFilter?.({ id: 'watch' } as never)).toBe(false)
    })

    it('opens on the first swap signer when the selected account cannot swap', () => {
        state.selected = { id: 'watch' }
        state.signers = [{ id: 'acc-2' }, { id: 'acc-1' }]

        renderHook(() => useSwapScreen())

        expect(mockSetSelectedAccountId).toHaveBeenCalledWith('acc-2')
    })

    it('keeps a selected account that can swap', () => {
        renderHook(() => useSwapScreen())

        expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
    })

    it('hands a resumed amount to the form, tied to the route pay asset', () => {
        routeParams.current = {
            assetInId: '123',
            assetOutId: '31566704',
            payAmount: '2.5',
        }

        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.initialPayAmount).toEqual({
            assetId: '123',
            amount: new Decimal('2.5'),
        })
        expect(mockSetFromAsset).toHaveBeenCalledWith('123')
    })

    it('returns the same resumed amount across renders', () => {
        routeParams.current = {
            assetInId: '123',
            assetOutId: '31566704',
            payAmount: '2.5',
        }

        const { result, rerender } = renderHook(() => useSwapScreen())
        const first = result.current.initialPayAmount
        rerender()

        expect(result.current.initialPayAmount).toBe(first)
    })

    it('has no amount to restore for an ordinary visit', () => {
        routeParams.current = { assetInId: '123', assetOutId: '31566704' }

        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.initialPayAmount).toBeUndefined()
    })

    it('opens the support page when the info button is pressed', () => {
        const { result } = renderHook(() => useSwapScreen())

        result.current.handleInfoPress()

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: expect.any(String),
        })
    })

    it('asks for the swap introduction once, then remembers it was seen', async () => {
        mockRequestBottomSheet.mockResolvedValue('start')

        const { result, rerender } = renderHook(() => useSwapScreen())

        await vi.waitFor(() =>
            expect(mockRequestBottomSheet).toHaveBeenCalled(),
        )
        rerender()

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockMarkIntroductionSeen).toHaveBeenCalled()
        expect(result.current.handleInfoPress).toBeDefined()
    })
})
