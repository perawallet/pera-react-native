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
const OTHER_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const {
    routeParams,
    mockSetFromAsset,
    mockSetToAsset,
    mockSetSourceChainId,
    mockSetReceivingAccountId,
    mockSetSelectedAccountId,
    mockSetParams,
    mockRequestBottomSheet,
    mockPushWebView,
    mockMarkIntroductionSeen,
    mockSeedSwapRouteAssets,
    state,
} = vi.hoisted(() => ({
    routeParams: { current: undefined as Record<string, unknown> | undefined },
    mockSetFromAsset: vi.fn(),
    mockSetToAsset: vi.fn(),
    mockSetSourceChainId: vi.fn(),
    mockSetReceivingAccountId: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockSetParams: vi.fn(),
    mockRequestBottomSheet: vi.fn(),
    mockPushWebView: vi.fn(),
    mockMarkIntroductionSeen: vi.fn(),
    mockSeedSwapRouteAssets: vi.fn(),
    state: {
        selected: null as Account | null,
        signers: [] as Account[],
        swapChainAccounts: new Set<string>(),
        sourceChainId: null as string | null,
        swapScope: null as { chainId: string; networkId: string } | null,
        isIntroductionSeen: false,
        isFocused: true,
    },
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({ params: routeParams.current }),
    useNavigation: () => ({ setParams: mockSetParams }),
    useIsFocused: () => state.isFocused,
}))

vi.mock('@perawallet/wallet-core-swaps', () => ({
    useSwapsStore: (
        selector: (store: {
            setFromAsset: typeof mockSetFromAsset
            setToAsset: typeof mockSetToAsset
            sourceChainId: string | null
            setSourceChainId: typeof mockSetSourceChainId
            setReceivingAccountId: typeof mockSetReceivingAccountId
        }) => unknown,
    ) =>
        selector({
            setFromAsset: mockSetFromAsset,
            setToAsset: mockSetToAsset,
            sourceChainId: state.sourceChainId,
            setSourceChainId: mockSetSourceChainId,
            setReceivingAccountId: mockSetReceivingAccountId,
        }),
    useSwapSourceScope: (account: Account | null) =>
        account && state.swapChainAccounts.has(account.id)
            ? (state.swapScope ?? SCOPE)
            : null,
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
    useSeedSwapRouteAssets: mockSeedSwapRouteAssets,
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
        state.isFocused = true
        state.sourceChainId = null
        state.swapScope = null
        mockSetSourceChainId.mockImplementation((chainId: string) => {
            state.sourceChainId = chainId
        })
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it("swaps on the selected account's chain scope", () => {
        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.scope).toEqual(SCOPE)
    })

    it('pins the source chain to the route asset, before seeding the pair', () => {
        routeParams.current = {
            assetIn: { chainId: 'algorand', assetId: '123' },
            assetOut: { chainId: 'algorand', assetId: '31566704' },
        }

        const { rerender } = renderHook(() => useSwapScreen())

        expect(mockSetSourceChainId).toHaveBeenCalledWith('algorand')
        expect(mockSetFromAsset).not.toHaveBeenCalled()

        rerender()

        expect(mockSetFromAsset).toHaveBeenCalledWith('123')
        expect(mockSetToAsset).toHaveBeenCalledWith('31566704')
    })

    describe('once a pick moves the swap off the route chain', () => {
        beforeEach(() => {
            routeParams.current = {
                assetIn: { chainId: 'algorand', assetId: '123' },
                assetOut: { chainId: 'algorand', assetId: '31566704' },
                payAmount: '5',
            }
            mockSetParams.mockImplementation(() => {
                routeParams.current = undefined
            })
        })

        it('spends the route', () => {
            const { rerender } = renderHook(() => useSwapScreen())
            rerender()

            state.sourceChainId = 'ethereum'
            rerender()

            expect(mockSetParams).toHaveBeenCalledWith({
                assetIn: undefined,
                assetOut: undefined,
                receive: undefined,
                payAmount: undefined,
            })
        })

        it('leaves a later pick back on the route chain alone', () => {
            const { rerender } = renderHook(() => useSwapScreen())
            rerender()
            state.sourceChainId = 'ethereum'
            rerender()
            rerender()
            mockSetFromAsset.mockClear()
            mockSetToAsset.mockClear()

            state.sourceChainId = 'algorand'
            rerender()

            expect(mockSetFromAsset).not.toHaveBeenCalled()
            expect(mockSetToAsset).not.toHaveBeenCalled()
        })
    })

    it('keeps the route while pinning its chain', () => {
        routeParams.current = {
            assetIn: { chainId: 'algorand', assetId: '123' },
        }
        const { rerender } = renderHook(() => useSwapScreen())

        rerender()

        expect(mockSetParams).not.toHaveBeenCalled()
    })

    it('clears the pair when an account switch moves the swap chain', () => {
        const { rerender } = renderHook(() => useSwapScreen())

        state.swapScope = OTHER_SCOPE
        rerender()

        expect(mockSetSourceChainId).toHaveBeenCalledWith(null)
    })

    it('leaves the pair to the store when the source chain moved', () => {
        const { rerender } = renderHook(() => useSwapScreen())

        state.sourceChainId = 'ethereum'
        state.swapScope = OTHER_SCOPE
        rerender()

        expect(mockSetSourceChainId).not.toHaveBeenCalled()
    })

    it('leaves the pair alone when the first scope resolves', () => {
        state.selected = null
        const { rerender } = renderHook(() => useSwapScreen())

        state.selected = { id: 'acc-1' }
        rerender()

        expect(mockSetSourceChainId).not.toHaveBeenCalled()
    })

    it('leaves the source chain alone for an ordinary visit', () => {
        renderHook(() => useSwapScreen())

        expect(mockSetSourceChainId).not.toHaveBeenCalled()
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

    it('leaves a watch account picked elsewhere selected while Swap is out of focus', () => {
        state.isFocused = false
        state.selected = { id: 'watch' }
        state.signers = [{ id: 'acc-2' }]

        renderHook(() => useSwapScreen())

        expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
    })

    it('opens on the first swap signer once Swap comes back into focus', () => {
        state.isFocused = false
        state.selected = { id: 'watch' }
        state.signers = [{ id: 'acc-2' }]
        const { rerender } = renderHook(() => useSwapScreen())

        state.isFocused = true
        rerender()

        expect(mockSetSelectedAccountId).toHaveBeenCalledWith('acc-2')
    })

    it('keeps a selected account that can swap', () => {
        renderHook(() => useSwapScreen())

        expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
    })

    it('hands a resumed amount to the form, tied to the route pay asset', () => {
        routeParams.current = {
            assetIn: { chainId: 'algorand', assetId: '123' },
            assetOut: { chainId: 'algorand', assetId: '31566704' },
            payAmount: '2.5',
        }

        const { result, rerender } = renderHook(() => useSwapScreen())

        expect(result.current.initialPayAmount).toEqual({
            chainId: 'algorand',
            assetId: '123',
            amount: new Decimal('2.5'),
        })

        rerender()

        expect(mockSetFromAsset).toHaveBeenCalledWith('123')
    })

    it("ties a resumed amount to the route's chain, not the one still in scope", () => {
        routeParams.current = {
            assetIn: { chainId: 'ethereum', assetId: 'native' },
            assetOut: { chainId: 'ethereum', assetId: '0xUSDC' },
            payAmount: '2.5',
        }

        const { result } = renderHook(() => useSwapScreen())

        expect(result.current.initialPayAmount).toEqual({
            chainId: 'ethereum',
            assetId: 'native',
            amount: new Decimal('2.5'),
        })
    })

    describe('a resumed cross-chain swap', () => {
        const RECEIVE_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' }

        beforeEach(() => {
            routeParams.current = {
                assetIn: { chainId: 'algorand', assetId: '123' },
                receive: {
                    scope: RECEIVE_SCOPE,
                    assetId: 'native',
                    accountId: 'acc-2',
                },
                payAmount: '2.5',
            }
        })

        it('seeds the pair on both chains once the source chain is pinned', () => {
            const { rerender } = renderHook(() => useSwapScreen())

            expect(mockSetSourceChainId).toHaveBeenCalledWith('algorand')
            expect(mockSetToAsset).not.toHaveBeenCalled()
            expect(mockSetReceivingAccountId).not.toHaveBeenCalled()

            rerender()

            expect(mockSetFromAsset).toHaveBeenCalledWith('123')
            expect(mockSetToAsset).toHaveBeenCalledOnce()
            expect(mockSetToAsset).toHaveBeenCalledWith('native', RECEIVE_SCOPE)
        })

        it('keeps the receiving account the user chose', () => {
            const { rerender } = renderHook(() => useSwapScreen())
            rerender()

            expect(mockSetReceivingAccountId).toHaveBeenCalledWith('acc-2')
        })

        it('looks the receive asset up on its own chain', () => {
            const { rerender } = renderHook(() => useSwapScreen())
            rerender()

            expect(mockSeedSwapRouteAssets).toHaveBeenLastCalledWith({
                assetInId: '123',
                assetOutId: 'native',
                assetOutScope: RECEIVE_SCOPE,
                scope: SCOPE,
            })
        })
    })

    it('resumes a same-chain swap with no receive target', () => {
        routeParams.current = {
            assetIn: { chainId: 'algorand', assetId: '123' },
            assetOut: { chainId: 'algorand', assetId: '456' },
            payAmount: '2.5',
        }

        const { rerender } = renderHook(() => useSwapScreen())
        rerender()

        expect(mockSetToAsset).toHaveBeenCalledWith('456')
        expect(mockSetReceivingAccountId).not.toHaveBeenCalled()
    })

    it('ignores a deeplink assetOut on another chain', () => {
        routeParams.current = {
            assetIn: { chainId: 'algorand', assetId: '123' },
            assetOut: { chainId: 'ethereum', assetId: 'native' },
        }

        const { rerender } = renderHook(() => useSwapScreen())
        rerender()

        expect(mockSetToAsset).toHaveBeenCalledWith('31566704')
        expect(mockSetToAsset).not.toHaveBeenCalledWith(
            'native',
            expect.anything(),
        )
    })

    it('returns the same resumed amount across renders', () => {
        routeParams.current = {
            assetIn: { chainId: 'algorand', assetId: '123' },
            assetOut: { chainId: 'algorand', assetId: '31566704' },
            payAmount: '2.5',
        }

        const { result, rerender } = renderHook(() => useSwapScreen())
        const first = result.current.initialPayAmount
        rerender()

        expect(result.current.initialPayAmount).toBe(first)
    })

    it('has no amount to restore for an ordinary visit', () => {
        routeParams.current = {
            assetIn: { chainId: 'algorand', assetId: '123' },
            assetOut: { chainId: 'algorand', assetId: '31566704' },
        }

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
