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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useImportSharedAccountScreen } from '../useImportSharedAccountScreen'

const SCANNED_ADDRESS = 'SHARED_ADDR'

const mockPush = vi.fn()
const mockRefetch = vi.fn()
const mockUseAllAccounts = vi.fn<() => WalletAccount[]>(() => [])
const mockUseMultisigAccountDetailQuery = vi.fn()

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: { address: SCANNED_ADDRESS } }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mockPush }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAllAccounts: () => mockUseAllAccounts(),
    }
})

vi.mock('@perawallet/wallet-core-multisig', () => ({
    useMultisigAccountDetailQuery: () => mockUseMultisigAccountDetailQuery(),
}))

const detail = {
    customId: 'c1',
    createdAt: new Date(),
    address: SCANNED_ADDRESS,
    version: 1,
    threshold: 2,
    participantAddresses: ['P1', 'P2', 'P3'],
}

describe('useImportSharedAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockUseMultisigAccountDetailQuery.mockReturnValue({
            data: detail,
            isLoading: false,
            isError: false,
            refetch: mockRefetch,
        })
    })

    it('exposes the fetched threshold and participants', () => {
        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.threshold).toBe(2)
        expect(result.current.participantAddresses).toEqual(['P1', 'P2', 'P3'])
        expect(result.current.totalParticipants).toBe(3)
        expect(result.current.isAddDisabled).toBe(false)
    })

    it('reports loading state with the add button disabled', () => {
        mockUseMultisigAccountDetailQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            refetch: mockRefetch,
        })

        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.isLoading).toBe(true)
        expect(result.current.isAddDisabled).toBe(true)
    })

    it('reports error state with the add button disabled', () => {
        mockUseMultisigAccountDetailQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            refetch: mockRefetch,
        })

        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.isError).toBe(true)
        expect(result.current.isAddDisabled).toBe(true)
    })

    it('flags when the user already holds one of the participants', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'P2', type: 'algo25' } as WalletAccount,
        ])

        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.isUserIncluded).toBe(true)
    })

    it('flags and disables when the shared account is already imported', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: SCANNED_ADDRESS, type: 'multisig' } as WalletAccount,
        ])

        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.isAlreadyImported).toBe(true)
        expect(result.current.isAddDisabled).toBe(true)
    })

    it('navigates to NameMultisig with the fetched account details', () => {
        const { result } = renderHook(() => useImportSharedAccountScreen())

        result.current.handleAddAccount()

        expect(mockPush).toHaveBeenCalledWith('NameMultisig', {
            address: SCANNED_ADDRESS,
            threshold: 2,
            addresses: ['P1', 'P2', 'P3'],
            version: 1,
        })
    })

    it('refetches on retry', () => {
        const { result } = renderHook(() => useImportSharedAccountScreen())

        result.current.handleRetry()

        expect(mockRefetch).toHaveBeenCalled()
    })
})
