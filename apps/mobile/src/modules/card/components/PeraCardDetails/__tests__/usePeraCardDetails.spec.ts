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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
    panLast4: null as string | null,
    fundingAddress: null as string | null,
    selectedFundingType: null as string | null,
    status: 'ACTIVE' as string | null,
    fetchStatus: 'idle' as string,
    hasInternet: true,
    cardDetailsMutateAsync: vi.fn(),
    freezeMutateAsync: vi.fn(),
    freezePending: false,
    unfreezeMutateAsync: vi.fn(),
    isUnfreezing: false,
    setPinMutateAsync: vi.fn(),
    setPinPending: false,
    requirePinVerification: vi.fn(),
    connectAsync: vi.fn(),
    pushWebView: vi.fn(),
    openURL: vi.fn(),
    infoToast: vi.fn(),
    errorToast: vi.fn(),
    request: vi.fn(),
    accounts: [] as unknown[],
    pickFundingSource: vi.fn(),
    delegateTo: vi.fn(),
    authorizeDelegation: vi.fn(),
    cancelDelegation: vi.fn(),
    canDelegate: vi.fn(),
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
    isPaused: false,
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
                selectedFundingType: string | null
            }) => unknown,
        ) =>
            selector({
                lastKnownPanLast4: mocks.panLast4,
                connectedFundingSourceAddress: mocks.fundingAddress,
                selectedFundingType: mocks.selectedFundingType,
            }),
        useConnectFundingSourceMutation: () =>
            mutationResult(mocks.connectAsync),
        useCardStatusQuery: () => ({
            data: mocks.status == null ? null : { status: mocks.status },
            fetchStatus: mocks.fetchStatus,
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

vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mocks.requirePinVerification,
    }),
}))

vi.mock('@modules/network', () => ({
    useNetworkStatus: () => ({ hasInternet: mocks.hasInternet }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => mocks.accounts,
}))

vi.mock('react-native', async importOriginal => {
    const actual = await importOriginal<object>()
    return {
        ...actual,
        Linking: { openURL: (...args: unknown[]) => mocks.openURL(...args) },
    }
})

// Mutable capability map: mutate `mockCapabilities` per test to simulate the
// native-shaped (inAppWebView: true) and web-shaped (false) route capability
// maps without re-mocking.
const { mockCapabilities } = vi.hoisted(() => ({
    mockCapabilities: { inAppWebView: true },
}))

vi.mock('@routes/capabilities', () => ({
    routeCapabilities: mockCapabilities,
}))

// Keep the real toast hooks (they use the mocked useToast); override only the
// delegation/picker hooks.
vi.mock('../../../hooks', async () => ({
    ...(await vi.importActual<object>('../../../hooks')),
    useCardFundingSourcePicker: () => ({
        pickFundingSource: mocks.pickFundingSource,
    }),
    useCardFundingDelegation: () => ({
        delegateTo: mocks.delegateTo,
        cancelDelegation: mocks.cancelDelegation,
        isPending: false,
        canDelegate: mocks.canDelegate,
    }),
    useAuthorizeCardDelegation: () => ({
        authorizeDelegation: mocks.authorizeDelegation,
    }),
}))

import { FundingType } from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { passThroughAuthorizeDelegation } from '@test-utils/cardDelegation'
import { ReportSuspiciousActivitySheet } from '../../ReportSuspiciousActivitySheet'
import { usePeraCardDetails } from '../usePeraCardDetails'

const walletAccount = (address: string): WalletAccount =>
    ({ address, type: 'algo25', keyPairId: `key-${address}` }) as WalletAccount

// Shared secure-view response the reveal tests resolve the token request with.
const SECURE_VIEW = { token: 'tok', imageUrl: 'https://secure/card.png' }

describe('usePeraCardDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(mockCapabilities, { inAppWebView: true })
        mocks.panLast4 = null
        mocks.fundingAddress = null
        mocks.selectedFundingType = null
        mocks.status = 'ACTIVE'
        mocks.fetchStatus = 'idle'
        mocks.hasInternet = true
        mocks.setPinPending = false
        mocks.requirePinVerification.mockResolvedValue(true)
        mocks.freezePending = false
        mocks.isUnfreezing = false
        mocks.accounts = []
        // The freeze sheet runs the freeze itself; opening it just resolves.
        mocks.request.mockResolvedValue(undefined)
        mocks.pickFundingSource.mockResolvedValue(null)
        mocks.connectAsync.mockResolvedValue({ fundingSourceId: 'fs_1' })
        mocks.delegateTo.mockResolvedValue(undefined)
        mocks.cancelDelegation.mockResolvedValue(undefined)
        mocks.canDelegate.mockReturnValue(true)
        // The consent + auth gate passes through to the delegate fn by default.
        mocks.authorizeDelegation.mockImplementation(
            passThroughAuthorizeDelegation,
        )
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

    it('reports hasCard true once the status query returns a card', () => {
        mocks.status = 'ACTIVE'

        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.hasCard).toBe(true)
    })

    it('reports hasCard false when no card has been created yet', () => {
        mocks.status = null

        const { result } = renderHook(() => usePeraCardDetails())

        expect(result.current.hasCard).toBe(false)
    })

    it('reveals, hides, and re-reveals from cache without re-fetching', async () => {
        mocks.cardDetailsMutateAsync.mockResolvedValue(SECURE_VIEW)

        const { result } = renderHook(() => usePeraCardDetails())
        expect(result.current.secureImageUrl).toBeNull()

        // First reveal fetches the token, then the image loads and opens.
        await act(async () => {
            await result.current.onToggleReveal()
        })
        act(() => {
            result.current.onSecureImageLoad()
        })
        expect(mocks.cardDetailsMutateAsync).toHaveBeenCalledTimes(1)
        expect(result.current.secureImageUrl).toBe(SECURE_VIEW.imageUrl)
        expect(result.current.isCardOpen).toBe(true)

        // Hiding flips closed but keeps the fetched image cached.
        await act(async () => {
            await result.current.onToggleReveal()
        })
        expect(result.current.isCardOpen).toBe(false)
        expect(result.current.secureImageUrl).toBe(SECURE_VIEW.imageUrl)

        // Re-reveal is instant: no second fetch and no pending state.
        await act(async () => {
            await result.current.onToggleReveal()
        })
        expect(mocks.cardDetailsMutateAsync).toHaveBeenCalledTimes(1)
        expect(result.current.isCardOpen).toBe(true)
        expect(result.current.isRevealing).toBe(false)
    })

    it('ignores a second reveal tap while the first token request is in flight', async () => {
        // Keep the first request pending across the second tap so both taps fire
        // in the same tick, before any re-render could disable the button.
        let resolveToken: (view: typeof SECURE_VIEW) => void = () => {}
        mocks.cardDetailsMutateAsync.mockImplementation(
            () =>
                new Promise<typeof SECURE_VIEW>(resolve => {
                    resolveToken = resolve
                }),
        )

        const { result, unmount } = renderHook(() => usePeraCardDetails())

        await act(async () => {
            result.current.onToggleReveal()
            result.current.onToggleReveal()
        })

        // Only one single-use token is spent despite the double-tap.
        expect(mocks.cardDetailsMutateAsync).toHaveBeenCalledTimes(1)

        // Settle the in-flight request, then unmount to clear the load timeout.
        await act(async () => {
            resolveToken(SECURE_VIEW)
        })
        unmount()
    })

    it('does not toast or setState when unmounted before the token resolves', async () => {
        vi.useFakeTimers()
        try {
            let resolveToken: (view: typeof SECURE_VIEW) => void = () => {}
            mocks.cardDetailsMutateAsync.mockImplementation(
                () =>
                    new Promise<typeof SECURE_VIEW>(resolve => {
                        resolveToken = resolve
                    }),
            )

            const { result, unmount } = renderHook(() => usePeraCardDetails())

            // Start the reveal, then leave the screen while the request is in flight.
            act(() => {
                result.current.onToggleReveal()
            })
            unmount()

            // The request resolves after unmount: the mounted guard skips the
            // setState + arming a new load timeout, so advancing past the timeout
            // window fires no error toast (the pre-fix bug).
            await act(async () => {
                resolveToken(SECURE_VIEW)
            })
            await act(async () => {
                await vi.advanceTimersByTimeAsync(20_000)
            })

            expect(mocks.errorToast).not.toHaveBeenCalled()
        } finally {
            vi.useRealTimers()
        }
    })

    it('auto re-masks after the idle period, keeping the cached image', async () => {
        vi.useFakeTimers()
        try {
            mocks.cardDetailsMutateAsync.mockResolvedValue(SECURE_VIEW)

            const { result } = renderHook(() => usePeraCardDetails())
            await act(async () => {
                await result.current.onToggleReveal()
            })
            act(() => {
                result.current.onSecureImageLoad()
            })
            expect(result.current.isCardOpen).toBe(true)

            // After the idle window the card re-masks itself.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(30_000)
            })
            expect(result.current.isCardOpen).toBe(false)
            // The image stays cached, so re-revealing is instant with no new token.
            expect(result.current.secureImageUrl).toBe(SECURE_VIEW.imageUrl)

            await act(async () => {
                await result.current.onToggleReveal()
            })
            expect(result.current.isCardOpen).toBe(true)
            expect(mocks.cardDetailsMutateAsync).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })

    it('requests the brand-styled secure image (customCss from the card art)', async () => {
        mocks.cardDetailsMutateAsync.mockResolvedValue(SECURE_VIEW)

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onToggleReveal()
        })

        expect(mocks.cardDetailsMutateAsync).toHaveBeenCalledWith({
            customCss: {
                cardBackgroundColor: '#FCCA44',
                cardTextColor: '#000000',
                panBackgroundColor: '#FFE858',
                panTextColor: '#000000',
            },
        })
    })

    it('stays pending and closed until the secure image has loaded', async () => {
        mocks.cardDetailsMutateAsync.mockResolvedValue(SECURE_VIEW)

        const { result } = renderHook(() => usePeraCardDetails())
        expect(result.current.isRevealing).toBe(false)

        await act(async () => {
            await result.current.onToggleReveal()
        })
        // Token fetched but the image is still downloading — the button stays
        // pending and the card stays closed (masked) until it renders.
        expect(result.current.secureImageUrl).toBe(SECURE_VIEW.imageUrl)
        expect(result.current.isRevealing).toBe(true)
        expect(result.current.isCardOpen).toBe(false)

        act(() => {
            result.current.onSecureImageLoad()
        })
        expect(result.current.isRevealing).toBe(false)
        expect(result.current.isCardOpen).toBe(true)
    })

    it('recovers to the masked card if the secure image never loads', async () => {
        vi.useFakeTimers()
        try {
            mocks.cardDetailsMutateAsync.mockResolvedValue(SECURE_VIEW)

            const { result } = renderHook(() => usePeraCardDetails())
            await act(async () => {
                await result.current.onToggleReveal()
            })
            expect(result.current.isRevealing).toBe(true)

            // onLoad/onError never fire — the load timeout is the escape hatch
            // so the button can't stay disabled forever.
            await act(async () => {
                await vi.advanceTimersByTimeAsync(20_000)
            })

            expect(result.current.secureImageUrl).toBeNull()
            expect(result.current.isRevealing).toBe(false)
            expect(mocks.errorToast).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
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
        mocks.cardDetailsMutateAsync.mockResolvedValue(SECURE_VIEW)

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            result.current.onToggleReveal()
        })
        expect(result.current.secureImageUrl).toBe(SECURE_VIEW.imageUrl)

        act(() => {
            result.current.onSecureImageError()
        })

        expect(result.current.secureImageUrl).toBeNull()
        expect(result.current.isRevealing).toBe(false)
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

    it('opens the freeze sheet when active and the unfreeze sheet when frozen', async () => {
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
        // Frozen → opens the unfreeze confirmation sheet; the unfreeze runs
        // inside it, not here.
        expect(mocks.request).toHaveBeenCalledTimes(2)
        expect(mocks.unfreezeMutateAsync).not.toHaveBeenCalled()
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

    // Unfreeze confirmation + execution now live in UnfreezeCardConfirmationSheet
    // (see its own spec); the options row only opens that sheet.

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
        expect(mocks.openURL).not.toHaveBeenCalled()
    })

    it('opens the hosted PIN page in a browser tab when inAppWebView is off (web)', async () => {
        Object.assign(mockCapabilities, { inAppWebView: false })
        mocks.setPinMutateAsync.mockResolvedValue({
            token: 'tok',
            hostedPageUrl: 'https://hosted/pin',
        })

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onSetPin()
        })

        expect(mocks.openURL).toHaveBeenCalledWith('https://hosted/pin')
        expect(mocks.pushWebView).not.toHaveBeenCalled()
    })

    it('does not start the set-PIN request when the PIN gate is not passed', async () => {
        mocks.requirePinVerification.mockResolvedValue(false)

        const { result } = renderHook(() => usePeraCardDetails())
        await act(async () => {
            await result.current.onSetPin()
        })

        expect(mocks.setPinMutateAsync).not.toHaveBeenCalled()
        expect(mocks.pushWebView).not.toHaveBeenCalled()
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

    it('opens the lost/stolen report sheet', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        act(() => {
            result.current.onReportLostStolen()
        })

        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.request.mock.calls[0][0]).toHaveProperty('contents')
    })

    it('starts the report-suspicious flow at the freeze intro', () => {
        const { result } = renderHook(() => usePeraCardDetails())

        act(() => {
            result.current.onReportSuspicious()
        })

        // An active card enters the flow at the freeze intro; the rest of the
        // chain is covered by useReportSuspiciousFlow's own tests.
        expect(mocks.request).toHaveBeenCalledTimes(1)
        expect(mocks.request.mock.calls[0][0].contents.type).toBe(
            ReportSuspiciousActivitySheet,
        )
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

    describe('funding type', () => {
        it('labels the funding type from the stored preference', () => {
            mocks.selectedFundingType = FundingType.Auto

            const { result } = renderHook(() => usePeraCardDetails())

            expect(result.current.fundingTypeLabel).toBe(
                'peraCard.setup_status.funding_type_auto_title',
            )
        })

        it('falls back to the manual label when nothing is stored', () => {
            const { result } = renderHook(() => usePeraCardDetails())

            expect(result.current.fundingTypeLabel).toBe(
                'peraCard.setup_status.funding_type_manual_title',
            )
        })

        it('opens the Select Funding Type sheet', () => {
            const { result } = renderHook(() => usePeraCardDetails())

            act(() => {
                result.current.onChangeFundingType()
            })

            expect(mocks.request).toHaveBeenCalledTimes(1)
            expect(mocks.request.mock.calls[0][0]).toHaveProperty('contents')
        })
    })

    describe('changing the funding account', () => {
        it('connects the picked account without delegating on manual funding', async () => {
            mocks.selectedFundingType = FundingType.Manual
            mocks.fundingAddress = 'OLD_ADDR'
            mocks.pickFundingSource.mockResolvedValue(walletAccount('NEW_ADDR'))

            const { result } = renderHook(() => usePeraCardDetails())
            await act(async () => {
                result.current.onChangeFunding()
            })

            expect(mocks.connectAsync).toHaveBeenCalledWith({
                address: 'NEW_ADDR',
            })
            expect(mocks.delegateTo).not.toHaveBeenCalled()
            expect(mocks.cancelDelegation).not.toHaveBeenCalled()
        })

        it('blocks changing the account while Auto funding is on', async () => {
            // The AutoDraw authorization (AB LSig + Killswitch box) is
            // per-account, so repointing under Auto would strand the old
            // account's live authorization. Blocked until change-funding is
            // unified onto the AB flow: switch to Manual → change → re-Auto.
            mocks.selectedFundingType = FundingType.Auto
            mocks.fundingAddress = 'OLD_ADDR'

            const { result } = renderHook(() => usePeraCardDetails())
            await act(async () => {
                result.current.onChangeFunding()
            })

            expect(mocks.infoToast).toHaveBeenCalledWith(
                'peraCard.account.funding_change_requires_manual_title',
                'peraCard.account.funding_change_requires_manual_body',
            )
            // Blocked before the picker even opens.
            expect(mocks.pickFundingSource).not.toHaveBeenCalled()
            expect(mocks.connectAsync).not.toHaveBeenCalled()
        })

        it('does nothing when the picker is dismissed or re-picks the same account', async () => {
            mocks.fundingAddress = 'OLD_ADDR'
            mocks.pickFundingSource.mockResolvedValue(walletAccount('OLD_ADDR'))

            const { result } = renderHook(() => usePeraCardDetails())
            await act(async () => {
                result.current.onChangeFunding()
            })

            expect(mocks.connectAsync).not.toHaveBeenCalled()
        })
    })

    describe('offline gating', () => {
        it('is offline when the device has no internet', () => {
            mocks.hasInternet = false

            const { result } = renderHook(() => usePeraCardDetails())

            expect(result.current.isOffline).toBe(true)
        })

        it('is offline while the status query is paused', () => {
            mocks.hasInternet = true
            mocks.fetchStatus = 'paused'

            const { result } = renderHook(() => usePeraCardDetails())

            expect(result.current.isOffline).toBe(true)
        })

        it('is not offline when online with a resolved status', () => {
            mocks.hasInternet = true
            mocks.fetchStatus = 'idle'

            const { result } = renderHook(() => usePeraCardDetails())

            expect(result.current.isOffline).toBe(false)
        })
    })
})
