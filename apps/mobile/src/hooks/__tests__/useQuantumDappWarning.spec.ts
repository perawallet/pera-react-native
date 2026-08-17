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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useBottomSheet } from '@modules/bottom-sheet'
import { QuantumDappWarningSheet } from '@components/QuantumDappWarningSheet'
import { useIsQuantumDappWarningEnabled } from '../useIsQuantumDappWarningEnabled'
import { useQuantumDappWarning } from '../useQuantumDappWarning'

type TestAccount = { address: string; type: string; authAddress?: string }

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(),
    isQuantumAccount: (account: { type: string }) => account.type === 'quantum',
    getSignerFor: (address: string, accounts: TestAccount[]) => {
        const account = accounts.find(a => a.address === address)
        if (!account) return null
        if (!account.authAddress) return account
        return accounts.find(a => a.address === account.authAddress) ?? null
    },
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(),
}))

vi.mock('../useIsQuantumDappWarningEnabled', () => ({
    useIsQuantumDappWarningEnabled: vi.fn(),
}))

vi.mock('@components/QuantumDappWarningSheet', () => ({
    QuantumDappWarningSheet: () => null,
}))

const QUANTUM_ADDRESS = 'QUANTUMADDRESS'
const STANDARD_ADDRESS = 'STANDARDADDRESS'
const REKEYED_TO_QUANTUM_ADDRESS = 'REKEYEDTOQUANTUMADDRESS'

describe('useQuantumDappWarning', () => {
    const mockRequest = vi.fn()
    const mockGetPreference = vi.fn()
    const mockSetPreference = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useIsQuantumDappWarningEnabled as Mock).mockReturnValue(true)
        ;(useAllAccounts as Mock).mockReturnValue([
            { address: QUANTUM_ADDRESS, type: 'quantum' },
            { address: STANDARD_ADDRESS, type: 'algo25' },
            {
                address: REKEYED_TO_QUANTUM_ADDRESS,
                type: 'algo25',
                authAddress: QUANTUM_ADDRESS,
            },
        ])
        mockGetPreference.mockReturnValue(null)
        ;(usePreferences as Mock).mockReturnValue({
            getPreference: mockGetPreference,
            setPreference: mockSetPreference,
        })
        mockRequest.mockResolvedValue('continue')
        ;(useBottomSheet as Mock).mockReturnValue({ request: mockRequest })
    })

    it('shows the sheet when an unacknowledged quantum account is involved', async () => {
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([
            QUANTUM_ADDRESS,
        ])

        expect(mockRequest).toHaveBeenCalledTimes(1)
        expect(mockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                contents: expect.objectContaining({
                    type: QuantumDappWarningSheet,
                }),
                options: expect.objectContaining({
                    enablePanDownToClose: false,
                    enableCloseOnBackdropPress: false,
                }),
            }),
        )
        expect(decision).toBe('continue')
    })

    it('shows the sheet for an ed25519 account rekeyed to a quantum auth', async () => {
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([
            REKEYED_TO_QUANTUM_ADDRESS,
        ])

        expect(mockRequest).toHaveBeenCalledTimes(1)
        expect(decision).toBe('continue')
    })

    it('continues without a sheet when no address is a quantum account', async () => {
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([
            STANDARD_ADDRESS,
        ])

        expect(mockRequest).not.toHaveBeenCalled()
        expect(decision).toBe('continue')
    })

    it('continues without a sheet once the warning has been acknowledged', async () => {
        mockGetPreference.mockReturnValue(true)
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([
            QUANTUM_ADDRESS,
        ])

        expect(mockRequest).not.toHaveBeenCalled()
        expect(decision).toBe('continue')
        expect(mockSetPreference).not.toHaveBeenCalled()
    })

    it('continues without a sheet when the warning is disabled', async () => {
        ;(useIsQuantumDappWarningEnabled as Mock).mockReturnValue(false)
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([
            QUANTUM_ADDRESS,
        ])

        expect(mockRequest).not.toHaveBeenCalled()
        expect(decision).toBe('continue')
        expect(mockSetPreference).not.toHaveBeenCalled()
    })

    it('continues without a sheet when there are no addresses', async () => {
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([])

        expect(mockRequest).not.toHaveBeenCalled()
        expect(decision).toBe('continue')
    })

    it('persists the acknowledgement when the user continues', async () => {
        const { result } = renderHook(() => useQuantumDappWarning())

        await result.current.confirmQuantumDappUsage([QUANTUM_ADDRESS])

        expect(mockSetPreference).toHaveBeenCalledWith(
            'quantum-dapp-warning-acknowledged',
            true,
        )
    })

    it('does not persist the acknowledgement when the user cancels', async () => {
        mockRequest.mockResolvedValue(undefined)
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([
            QUANTUM_ADDRESS,
        ])

        expect(decision).toBe('cancel')
        expect(mockSetPreference).not.toHaveBeenCalled()
    })

    it('ignores addresses that match no known account', async () => {
        const { result } = renderHook(() => useQuantumDappWarning())

        const decision = await result.current.confirmQuantumDappUsage([
            'UNKNOWN',
        ])

        expect(mockRequest).not.toHaveBeenCalled()
        expect(decision).toBe('continue')
    })

    it('propagates a rejection when no BottomSheetManager is mounted', async () => {
        mockRequest.mockRejectedValue(new Error('no host'))
        const { result } = renderHook(() => useQuantumDappWarning())

        await expect(
            result.current.confirmQuantumDappUsage([QUANTUM_ADDRESS]),
        ).rejects.toThrow('no host')

        expect(mockSetPreference).not.toHaveBeenCalled()
    })
})
