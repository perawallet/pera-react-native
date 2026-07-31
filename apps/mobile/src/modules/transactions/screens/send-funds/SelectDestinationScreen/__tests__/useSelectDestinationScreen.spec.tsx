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

import { act, renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    canSignWith,
    useAccountBalancesQuery,
    useAllAccounts,
    useOnChainAccountInformationQuery,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useSelectDestinationScreen } from '../useSelectDestinationScreen'

const mockNavigate = vi.fn()
const mockSetSendMode = vi.fn()
const mockSetDestination = vi.fn()

const { mockCanSignWith, mockUseAllAccounts } = vi.hoisted(() => ({
    mockCanSignWith: vi.fn(),
    mockUseAllAccounts: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    canSignWith: mockCanSignWith,
    useAccountBalancesQuery: vi.fn(),
    useAllAccounts: mockUseAllAccounts,
    useOnChainAccountInformationQuery: vi.fn(),
    useSelectedAccount: vi.fn(() => ({ address: 'SENDERADDR' })),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(() => ({
        data: new Map([['123', { assetId: '123', name: 'TestToken' }]]),
    })),
}))

const ASA_ID = '123'
const EXTERNAL_ADDR = 'EXTERNALADDR'
const INTERNAL_SIGNABLE_ADDR = 'SIGNABLEADDR'
const INTERNAL_WATCH_ADDR = 'WATCHADDR'
const INTERNAL_OPTED_IN_ADDR = 'OPTEDINADDR'

describe('useSelectDestinationScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockUseAllAccounts.mockReturnValue([])
        mockCanSignWith.mockReturnValue(false)

        // clearAllMocks wipes call history but keeps implementations, so a
        // per-test mockReturnValue on useAssetsQuery would leak. Re-seed the
        // default (ASA_ID resolvable) every run.
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([[ASA_ID, { assetId: ASA_ID, name: 'TestToken' }]]),
        })

        ;(useSendFunds as Mock).mockReturnValue({
            selectedAssetId: ASA_ID,
            setDestination: mockSetDestination,
            setSendMode: mockSetSendMode,
        })

        ;(useAccountBalancesQuery as Mock).mockReturnValue({
            accountBalances: new Map(),
        })

        ;(useAllAccounts as Mock).mockReturnValue([])
        ;(canSignWith as Mock).mockReturnValue(false)
        ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
            data: undefined,
            isFetching: false,
            isSuccess: false,
            isError: false,
        })
    })

    it('navigates to ConfirmTransaction for ALGO sends', () => {
        ;(useSendFunds as Mock).mockReturnValue({
            selectedAssetId: '0',
            setDestination: mockSetDestination,
            setSendMode: mockSetSendMode,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        act(() => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('normal')
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('navigates to ConfirmTransaction for internal account already opted in', () => {
        ;(useAccountBalancesQuery as Mock).mockReturnValue({
            accountBalances: new Map([
                [
                    INTERNAL_OPTED_IN_ADDR,
                    { assetBalances: [{ assetId: ASA_ID }] },
                ],
            ]),
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        act(() => {
            result.current.handleSelected(INTERNAL_OPTED_IN_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('normal')
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('navigates to ExpressSend for internal signable account not opted in', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: INTERNAL_SIGNABLE_ADDR, name: 'Signable' },
        ])
        mockCanSignWith.mockReturnValue(true)

        const { result } = renderHook(() => useSelectDestinationScreen())

        act(() => {
            result.current.handleSelected(INTERNAL_SIGNABLE_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('express')
        expect(mockNavigate).toHaveBeenCalledWith('ExpressSend')
    })

    it('navigates to ARC59SendSummary for internal watch account not opted in', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: INTERNAL_WATCH_ADDR, name: 'Watch' },
        ])
        mockCanSignWith.mockReturnValue(false)

        const { result } = renderHook(() => useSelectDestinationScreen())

        act(() => {
            result.current.handleSelected(INTERNAL_WATCH_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('sendArc59')
        expect(mockNavigate).toHaveBeenCalledWith('ARC59SendSummary')
    })

    it('navigates to ConfirmTransaction for external account already opted in on-chain', async () => {
        ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
            data: {
                assets: [
                    { assetId: BigInt(ASA_ID), amount: 100n, isFrozen: false },
                ],
            },
            isFetching: false,
            isSuccess: true,
            isError: false,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('normal')
        expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
    })

    it('navigates to ARC59SendSummary for external account not opted in on-chain', async () => {
        ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
            data: { assets: [] },
            isFetching: false,
            isSuccess: true,
            isError: false,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('sendArc59')
        expect(mockNavigate).toHaveBeenCalledWith('ARC59SendSummary')
    })

    it('falls back to ARC59SendSummary when on-chain query fails for external account', async () => {
        ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
            data: undefined,
            isFetching: false,
            isSuccess: false,
            isError: true,
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('sendArc59')
        expect(mockNavigate).toHaveBeenCalledWith('ARC59SendSummary')
    })

    // A value-bearing deeplink (algorand://<address>?amount=…) prefills the
    // destination before this screen mounts. The receiver is already known, so
    // the picker must be bypassed and the flow routed straight through.
    describe('prefilled deeplink destination', () => {
        it('auto-uses the prefilled destination and skips the picker (ALGO)', () => {
            ;(useAssetsQuery as Mock).mockReturnValue({
                data: new Map([['0', { assetId: '0', name: 'Algo' }]]),
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: '0',
                destination: EXTERNAL_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(mockSetDestination).toHaveBeenCalledWith(EXTERNAL_ADDR)
            expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
            expect(result.current.isAutoAdvancing).toBe(false)
        })

        it('auto-uses the prefilled destination for an opted-in ASA receiver', () => {
            ;(useAccountBalancesQuery as Mock).mockReturnValue({
                accountBalances: new Map([
                    [
                        INTERNAL_OPTED_IN_ADDR,
                        { assetBalances: [{ assetId: ASA_ID }] },
                    ],
                ]),
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: ASA_ID,
                destination: INTERNAL_OPTED_IN_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            renderHook(() => useSelectDestinationScreen())

            expect(mockSetDestination).toHaveBeenCalledWith(
                INTERNAL_OPTED_IN_ADDR,
            )
            expect(mockNavigate).toHaveBeenCalledWith('ConfirmTransaction')
        })

        it('routes an unopted-in external prefilled receiver through ARC59', async () => {
            ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
                data: { assets: [] },
                isFetching: false,
                isSuccess: true,
                isError: false,
            })
            ;(useSendFunds as Mock).mockReturnValue({
                selectedAssetId: ASA_ID,
                destination: EXTERNAL_ADDR,
                setDestination: mockSetDestination,
                setSendMode: mockSetSendMode,
            })

            await act(async () => {
                renderHook(() => useSelectDestinationScreen())
            })

            expect(mockSetSendMode).toHaveBeenCalledWith('sendArc59')
            expect(mockNavigate).toHaveBeenCalledWith('ARC59SendSummary')
        })

        it('shows the picker (no auto-advance) when no destination is prefilled', () => {
            const { result } = renderHook(() => useSelectDestinationScreen())

            expect(mockNavigate).not.toHaveBeenCalled()
            expect(result.current.isAutoAdvancing).toBe(false)
        })
    })
})
