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
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    panLast4: null as string | null,
    fundingAddress: null as string | null,
    status: 'ACTIVE' as string | null,
    cardDetailsMutateAsync: vi.fn(),
    freezeMutateAsync: vi.fn(),
    freezePending: false,
    unfreezeMutateAsync: vi.fn(),
    isUnfreezing: false,
    setPinMutateAsync: vi.fn(),
    setPinPending: false,
    pushWebView: vi.fn(),
    infoToast: vi.fn(),
    errorToast: vi.fn(),
    request: vi.fn(),
}))

const mutationResult = (
    mutateAsync: ReturnType<typeof vi.fn>,
    isPending = false,
) => ({
    mutate: vi.fn(),
    mutateAsync,
    isPending,
    isError: false,
    isSuccess: false,
    error: null,
    data: null,
    reset: vi.fn(),
})

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: (
            selector: (state: {
                lastKnownPanLast4: string | null
                connectedFundingSourceAddress: string | null
            }) => unknown,
        ) =>
            selector({
                lastKnownPanLast4: mocks.panLast4,
                connectedFundingSourceAddress: mocks.fundingAddress,
            }),
        useCardStatusQuery: () => ({
            data: mocks.status == null ? null : { status: mocks.status },
        }),
        useCardDetailsMutation: () =>
            mutationResult(mocks.cardDetailsMutateAsync),
        useFreezeCardMutation: () =>
            mutationResult(mocks.freezeMutateAsync, mocks.freezePending),
        useUnfreezeCardMutation: () =>
            mutationResult(mocks.unfreezeMutateAsync),
        useIsCardUnfreezing: () => mocks.isUnfreezing,
        useSetCardPinMutation: () =>
            mutationResult(mocks.setPinMutateAsync, mocks.setPinPending),
    }
})

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: mocks.infoToast,
        errorToast: mocks.errorToast,
        showToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mocks.pushWebView,
        removeWebView: vi.fn(),
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mocks.request,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

import { usePeraCardDetails } from '../usePeraCardDetails'

describe('usePeraCardDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.panLast4 = null
        mocks.fundingAddress = null
        mocks.status = 'ACTIVE'
        mocks.setPinPending = false
        mocks.freezePending = false
        mocks.isUnfreezing = false
        // The freeze sheet runs the freeze itself; opening it just resolves.
        mocks.request.mockResolvedValue(undefined)
    })

    it('masks the PAN with the last 4 when known', () => {
        mocks.panLast4 = '2234'

        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.maskedPan).toBe('•••• 2234')
    })

    it('falls back to a fully-masked PAN when the last 4 is unknown', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.maskedPan).toBe('•••• ••••')
    })

    it('exposes the connected funding address from the store', () => {
        mocks.fundingAddress = 'QKZ6ABCDEFG2IHH'

        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.fundingAddress).toBe('QKZ6ABCDEFG2IHH')
    })

    it('reveals the secure image, then hides it without re-fetching', async () => {
        mocks.cardDetailsMutateAsync.mockResolvedValue({
            token: 'tok',
            imageUrl: 'https://secure/card.png',
        })

        const { result } = renderHook(() => usePeraCardDetails())
        expect(result.current.secureImageUrl).toBeNull()

        await act(async () => {
            await result.current.onToggleReveal()
        })
        expect(mocks.cardDetailsMutateAsync).toHaveBeenCalledTimes(1)
        expect(result.current.secureImageUrl).toBe('https://secure/card.png')

        await act(async () => {
            await result.current.onToggleReveal()
        })
        expect(result.current.secureImageUrl).toBeNull()
        // Hiding must not call the secure-view endpoint again.
        expect(mocks.cardDetailsMutateAsync).toHaveBeenCalledTimes(1)
    })

    it('surfaces the real API error message when revealing fails', async () => {
        // ky HTTPError shape: status in `response`, parsed body in `data`.
        mocks.cardDetailsMutateAsync.mockRejectedValue({
            response: { status: 400 },
            data: { message: "user doesn't have a card" },
        })

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onToggleReveal()
        })

        expect(result.current.secureImageUrl).toBeNull()
        expect(mocks.errorToast).toHaveBeenCalledWith(
            expect.any(String),
            "user doesn't have a card",
        )
    })

    it('hides the secure image and toasts when it fails to load', async () => {
        mocks.cardDetailsMutateAsync.mockResolvedValue({
            token: 'tok',
            imageUrl: 'https://secure/card.png',
        })

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            result.current.onToggleReveal()
        })
        expect(result.current.secureImageUrl).toBe('https://secure/card.png')

        act(() => {
            result.current.onSecureImageError()
        })

        expect(result.current.secureImageUrl).toBeNull()
        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
    })

    it('falls back to a generic body when the error has no message', async () => {
        mocks.cardDetailsMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onToggleReveal()
        })

        expect(result.current.secureImageUrl).toBeNull()
        expect(mocks.errorToast).toHaveBeenCalledWith(
            'peraCard.account.error_title',
            'peraCard.account.error_body',
        )
    })

    it('opens the freeze sheet when active, and unfreezes directly when frozen', async () => {
        mocks.unfreezeMutateAsync.mockResolvedValue(undefined)

        const { result, rerender } = renderHook(() => usePeraCardDetails())
        expect(result.current.isFrozen).toBe(false)
        // The test i18n returns raw keys, so assert on the key, not the copy.
        expect(result.current.freezeLabel).toBe('peraCard.account.freeze_card')

        await act(async () => {
            await result.current.onToggleFreeze()
        })
        // Active → opens the confirmation sheet; the freeze runs inside it, not here.
        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.request.mock.calls[0][0]).toHaveProperty('contents')
        expect(mocks.freezeMutateAsync).not.toHaveBeenCalled()
        expect(mocks.unfreezeMutateAsync).not.toHaveBeenCalled()

        mocks.status = 'FROZEN'
        rerender()
        expect(result.current.isFrozen).toBe(true)
        expect(result.current.freezeLabel).toBe(
            'peraCard.account.unfreeze_card',
        )

        await act(async () => {
            await result.current.onToggleFreeze()
        })
        // Frozen → unfreezes directly, no sheet.
        expect(mocks.unfreezeMutateAsync).toHaveBeenCalledTimes(1)
        expect(mocks.request).toHaveBeenCalledTimes(1)
    })

    it('allows the freeze toggle for an active or frozen card', () => {
        mocks.status = 'ACTIVE'

        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.canToggleFreeze).toBe(true)
    })

    it('hides the freeze toggle for a blocked card', () => {
        mocks.status = 'BLOCKED'

        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.canToggleFreeze).toBe(false)
    })

    it('surfaces an error toast when unfreezing fails', async () => {
        mocks.status = 'FROZEN'
        mocks.unfreezeMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onToggleFreeze()
        })

        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
    })

    it('does not start a second unfreeze request while one is in flight', async () => {
        mocks.status = 'FROZEN'
        mocks.isUnfreezing = true

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onToggleFreeze()
        })

        expect(mocks.unfreezeMutateAsync).not.toHaveBeenCalled()
    })

    it('opens the hosted page in a WebView on Set PIN', async () => {
        mocks.setPinMutateAsync.mockResolvedValue({
            token: 'tok',
            hostedPageUrl: 'https://hosted/pin',
        })

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onSetPin()
        })

        expect(mocks.pushWebView).toHaveBeenCalledWith({
            url: 'https://hosted/pin',
            id: 'card-set-pin',
        })
    })

    it('does not start a second set-PIN request while one is pending', async () => {
        mocks.setPinPending = true

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onSetPin()
        })

        expect(mocks.setPinMutateAsync).not.toHaveBeenCalled()
        expect(mocks.pushWebView).not.toHaveBeenCalled()
    })

    it('surfaces an error toast when the set-PIN request fails', async () => {
        mocks.setPinMutateAsync.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onSetPin()
        })

        expect(mocks.pushWebView).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledTimes(1)
    })

    it('shows a coming-soon toast for stubbed actions', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        act(() => {
            result.current.onReportLostStolen()
        })

        expect(mocks.infoToast).toHaveBeenCalledTimes(1)
    })

    it('opens the wallet instructions bottom sheet from Add to Wallet', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        act(() => {
            result.current.onAddToWallet()
        })

        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.request.mock.calls[0][0]).toHaveProperty('contents')
    })

    it('resolves a single wallet-provisioning platform', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        expect(['apple', 'google']).toContain(result.current.walletPlatform)
    })

    it('opens the account details bottom sheet', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        act(() => {
            result.current.onAccountsDetails()
        })

        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.request.mock.calls[0][0]).toHaveProperty('contents')
    })
})
