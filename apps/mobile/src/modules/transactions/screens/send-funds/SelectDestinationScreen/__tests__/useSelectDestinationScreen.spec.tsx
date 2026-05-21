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

import { act, renderHook } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    isSigningLogicalType,
    useAccountBalancesQuery,
    useAllAccountLogicalTypes,
    useOnChainAccountInformationQuery,
} from '@perawallet/wallet-core-accounts'
import { useSelectDestinationScreen } from '../useSelectDestinationScreen'

const mockNavigate = vi.fn()
const mockSetSendMode = vi.fn()
const mockSetDestination = vi.fn()

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isSigningLogicalType: vi.fn(),
    useAccountBalancesQuery: vi.fn(),
    useAllAccountLogicalTypes: vi.fn(),
    useAllAccounts: vi.fn(() => []),
    useOnChainAccountInformationQuery: vi.fn(),
    useSelectedAccount: vi.fn(() => ({ address: 'SENDERADDR' })),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: '0',
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

        ;(useSendFunds as Mock).mockReturnValue({
            selectedAssetId: ASA_ID,
            setDestination: mockSetDestination,
            setSendMode: mockSetSendMode,
        })

        ;(useAccountBalancesQuery as Mock).mockReturnValue({
            accountBalances: new Map(),
        })

        ;(useAllAccountLogicalTypes as Mock).mockReturnValue(new Map())

        ;(useOnChainAccountInformationQuery as Mock).mockReturnValue({
            data: undefined,
            isFetching: false,
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
        ;(useAllAccountLogicalTypes as Mock).mockReturnValue(
            new Map([[INTERNAL_SIGNABLE_ADDR, 'standard']]),
        )
        ;(isSigningLogicalType as Mock).mockReturnValue(true)

        const { result } = renderHook(() => useSelectDestinationScreen())

        act(() => {
            result.current.handleSelected(INTERNAL_SIGNABLE_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('express')
        expect(mockNavigate).toHaveBeenCalledWith('ExpressSend')
    })

    it('navigates to ARC59SendSummary for internal watch account not opted in', () => {
        ;(useAllAccountLogicalTypes as Mock).mockReturnValue(
            new Map([[INTERNAL_WATCH_ADDR, 'watch']]),
        )
        ;(isSigningLogicalType as Mock).mockReturnValue(false)

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
        })

        const { result } = renderHook(() => useSelectDestinationScreen())

        await act(async () => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        expect(mockSetSendMode).toHaveBeenCalledWith('sendArc59')
        expect(mockNavigate).toHaveBeenCalledWith('ARC59SendSummary')
    })
})
