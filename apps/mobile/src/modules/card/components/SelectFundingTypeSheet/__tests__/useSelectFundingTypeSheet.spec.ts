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
import { act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FundingType } from '@perawallet/wallet-core-card'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { CardEvent } from '@analytics'
import { passThroughAuthorizeDelegation } from '@test-utils/cardDelegation'

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))
vi.mock('@analytics', async () => {
    const actual = await vi.importActual<object>('@analytics')
    return { ...actual, trackEvent: mockTrackEvent }
})

const mockSetSelectedFundingType = vi.fn()
let mockStoredFundingType: FundingType | null = null
let mockConnectedAddress: string | null = null
let mockEscrowCardAddress: string | null = null
let mockEscrowCardOwner: string | null = null
let mockEscrowCardNetwork: string | null = null

vi.mock('@perawallet/wallet-core-card', async () => {
    const actual = await vi.importActual<object>('@perawallet/wallet-core-card')
    return {
        ...actual,
        useCardStore: Object.assign(
            (selector: (state: Record<string, unknown>) => unknown) =>
                selector({
                    selectedFundingType: mockStoredFundingType,
                    connectedFundingSourceAddress: mockConnectedAddress,
                    escrowCardAddress: mockEscrowCardAddress,
                    escrowCardOwner: mockEscrowCardOwner,
                    escrowCardNetwork: mockEscrowCardNetwork,
                }),
            {
                getState: () => ({
                    selectedFundingType: mockStoredFundingType,
                    setSelectedFundingType: mockSetSelectedFundingType,
                }),
            },
        ),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-blockchain')),
    useNetwork: () => ({ network: 'testnet' }),
}))

let mockAccounts: WalletAccount[] = []
vi.mock('@perawallet/wallet-core-accounts', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-accounts')),
    useAllAccounts: () => mockAccounts,
}))

const mockResolve = vi.fn()
const mockDismiss = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: mockResolve,
        dismiss: mockDismiss,
    }),
}))

const mockRequirePin = vi.fn()
vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: mockRequirePin,
    }),
}))

const mockEnableAutoDraw = vi.fn()
const mockDisableAutoDraw = vi.fn()
const mockCanSwitchToAuto = vi.fn()
const mockShowCardError = vi.fn()
// The consent gate passes through to its delegate by default so Auto tests
// observe enableAutoDraw; the declined-consent test overrides it.
const mockAuthorizeDelegation = vi.fn(passThroughAuthorizeDelegation)
vi.mock('../../../hooks', () => ({
    useCardErrorToast: () => mockShowCardError,
    useAutoDrawSwitch: () => ({
        enableAutoDraw: mockEnableAutoDraw,
        disableAutoDraw: mockDisableAutoDraw,
        canSwitchToAuto: mockCanSwitchToAuto,
        isPending: false,
    }),
    useAuthorizeCardDelegation: () => ({
        authorizeDelegation: mockAuthorizeDelegation,
    }),
}))

const mockSuccessToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        successToast: mockSuccessToast,
        errorToast: vi.fn(),
        infoToast: vi.fn(),
        showToast: vi.fn(),
    }),
}))

let mockIsAutoFundingEnabled = true
vi.mock('@hooks/useIsCardAutoFundingEnabled', () => ({
    useIsCardAutoFundingEnabled: () => mockIsAutoFundingEnabled,
}))

import { useSelectFundingTypeSheet } from '../useSelectFundingTypeSheet'

const connectedAccount = {
    address: 'ADDR1',
    type: 'algo25',
    keyPairId: 'key-1',
} as unknown as WalletAccount

const CARD = 'ESCROWCARD1'

describe('useSelectFundingTypeSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockStoredFundingType = FundingType.Manual
        mockConnectedAddress = 'ADDR1'
        // An escrow card exists for the connected account on this network.
        mockEscrowCardAddress = CARD
        mockEscrowCardOwner = 'ADDR1'
        mockEscrowCardNetwork = 'testnet'
        mockAccounts = [connectedAccount]
        mockEnableAutoDraw.mockResolvedValue(undefined)
        mockDisableAutoDraw.mockResolvedValue(undefined)
        mockCanSwitchToAuto.mockReturnValue(true)
        mockRequirePin.mockResolvedValue(true)
        mockIsAutoFundingEnabled = true
        mockAuthorizeDelegation.mockImplementation(
            passThroughAuthorizeDelegation,
        )
    })

    it('seeds the selection from the stored funding type', () => {
        mockStoredFundingType = FundingType.Auto
        const { result } = renderHook(() => useSelectFundingTypeSheet())
        expect(result.current.selectedType).toBe(FundingType.Auto)
    })

    it('treats an unset funding type as Manual, matching the details row', () => {
        mockStoredFundingType = null
        const { result } = renderHook(() => useSelectFundingTypeSheet())
        expect(result.current.selectedType).toBe(FundingType.Manual)
    })

    it('dismisses without any call when applying with no change', async () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onApply())

        await waitFor(() => expect(mockDismiss).toHaveBeenCalled())
        expect(mockEnableAutoDraw).not.toHaveBeenCalled()
        expect(mockDisableAutoDraw).not.toHaveBeenCalled()
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
    })

    it('dismisses on Auto → Auto (already Auto, no change)', async () => {
        mockStoredFundingType = FundingType.Auto
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onApply())

        await waitFor(() => expect(mockDismiss).toHaveBeenCalled())
        expect(mockEnableAutoDraw).not.toHaveBeenCalled()
    })

    it('enables auto-draw then persists when switching Manual → Auto', async () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Auto))
        act(() => result.current.onApply())

        await waitFor(() =>
            expect(mockEnableAutoDraw).toHaveBeenCalledWith(
                connectedAccount,
                CARD,
            ),
        )
        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Auto,
        )
        expect(mockSuccessToast).toHaveBeenCalled()
        expect(mockResolve).toHaveBeenCalledWith('applied')
        expect(mockTrackEvent).toHaveBeenCalledWith(CardEvent.SelectFundingAuto)
        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.SelectFundingApply,
        )
    })

    it('tracks the manual option tap', () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Manual))

        expect(mockTrackEvent).toHaveBeenCalledWith(
            CardEvent.SelectFundingManual,
        )
    })

    it('PIN-gates then disables auto-draw when switching Auto → Manual', async () => {
        mockStoredFundingType = FundingType.Auto
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Manual))
        act(() => result.current.onApply())

        await waitFor(() =>
            expect(mockDisableAutoDraw).toHaveBeenCalledWith(connectedAccount),
        )
        expect(mockRequirePin).toHaveBeenCalled()
        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Manual,
        )
    })

    it('routes the Auto grant through the consent + auth gate', async () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Auto))
        act(() => result.current.onApply())

        await waitFor(() =>
            expect(mockAuthorizeDelegation).toHaveBeenCalledWith(
                connectedAccount,
                expect.any(Function),
            ),
        )
    })

    it('keeps the sheet open and skips persisting when authorization is declined', async () => {
        mockAuthorizeDelegation.mockResolvedValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Auto))
        act(() => result.current.onApply())

        await waitFor(() => expect(mockAuthorizeDelegation).toHaveBeenCalled())
        expect(mockEnableAutoDraw).not.toHaveBeenCalled()
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
        expect(mockResolve).not.toHaveBeenCalled()
    })

    it('cancels cleanly when the Manual PIN gate is declined', async () => {
        mockStoredFundingType = FundingType.Auto
        mockRequirePin.mockResolvedValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Manual))
        act(() => result.current.onApply())

        await waitFor(() => expect(mockRequirePin).toHaveBeenCalled())
        expect(mockDisableAutoDraw).not.toHaveBeenCalled()
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
        expect(mockResolve).not.toHaveBeenCalled()
    })

    it('errors when switching to Auto with no escrow card for the account/network', async () => {
        mockEscrowCardOwner = 'SOMEONE_ELSE'
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Auto))
        act(() => result.current.onApply())

        await waitFor(() => expect(mockShowCardError).toHaveBeenCalled())
        expect(mockEnableAutoDraw).not.toHaveBeenCalled()
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
    })

    it('allows switching to Manual without a card address (kill needs none)', async () => {
        // Persisted Auto but no card for THIS account/network (e.g. after a
        // network switch) — turning auto off must still work.
        mockStoredFundingType = FundingType.Auto
        mockEscrowCardOwner = 'SOMEONE_ELSE'
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Manual))
        act(() => result.current.onApply())

        await waitFor(() =>
            expect(mockDisableAutoDraw).toHaveBeenCalledWith(connectedAccount),
        )
        expect(mockSetSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Manual,
        )
    })

    it('keeps the sheet open and skips the store write on failure', async () => {
        mockEnableAutoDraw.mockRejectedValue(new Error('chain down'))
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        act(() => result.current.onSelectType(FundingType.Auto))
        act(() => result.current.onApply())

        await waitFor(() => expect(mockShowCardError).toHaveBeenCalled())
        expect(mockSetSelectedFundingType).not.toHaveBeenCalled()
        expect(mockResolve).not.toHaveBeenCalled()
        expect(mockDismiss).not.toHaveBeenCalled()
    })

    it('disables the Auto option when the connected account cannot sign', () => {
        mockCanSwitchToAuto.mockReturnValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())
        expect(result.current.isAutoDisabled).toBe(true)
    })

    it('falls back from a seeded Auto to Manual when the account cannot sign', () => {
        mockStoredFundingType = FundingType.Auto
        mockCanSwitchToAuto.mockReturnValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.isAutoDisabled).toBe(true)
        expect(result.current.selectedType).toBe(FundingType.Manual)
    })

    it('flags a Ledger connected account (drives the Ledger-specific hint)', () => {
        mockAccounts = [
            {
                address: 'ADDR1',
                type: 'hardware',
                hardwareDetails: { manufacturer: 'ledger' },
            } as unknown as WalletAccount,
        ]
        mockCanSwitchToAuto.mockReturnValue(false)
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.isLedgerAccount).toBe(true)
        expect(result.current.isAutoDisabled).toBe(true)
    })

    it('does not flag a signing-capable account as Ledger', () => {
        const { result } = renderHook(() => useSelectFundingTypeSheet())
        expect(result.current.isLedgerAccount).toBe(false)
    })

    it('disables Auto when the kill-switch flag is off', () => {
        mockIsAutoFundingEnabled = false
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.isAutoDisabled).toBe(true)
        expect(result.current.isAutoFundingEnabled).toBe(false)
    })

    it('migrates a seeded Auto to Manual when the kill-switch flag is off', () => {
        mockStoredFundingType = FundingType.Auto
        mockIsAutoFundingEnabled = false
        const { result } = renderHook(() => useSelectFundingTypeSheet())

        expect(result.current.selectedType).toBe(FundingType.Manual)
    })
})
