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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useImportSharedAccountScreen } from '../useImportSharedAccountScreen'

const SCANNED_ADDRESS = 'SHARED_ADDR'

const mockPush = vi.fn()
const mockRefetch = vi.fn()
const mockExitAccountFlow = vi.fn()
const mockDeleteImportInbox = vi.fn()
const mockUseAllAccounts = vi.fn<() => WalletAccount[]>(() => [])
const mockUseMultisigAccountDetailQuery = vi.fn()
const mockUseDeviceID = vi.fn<() => string | null>(() => 'device-1')

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
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
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
    useDeleteImportInboxMutation: () => ({ mutate: mockDeleteImportInbox }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => mockUseDeviceID(),
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useExitAccountFlow: () => ({ exitAccountFlow: mockExitAccountFlow }),
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
        mockUseDeviceID.mockReturnValue('device-1')
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

    it('reports canUserSign true when a held participant has its own key', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'P2', type: 'algo25', keyPairId: 'kp' } as WalletAccount,
        ])

        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.isUserIncluded).toBe(true)
        expect(result.current.canUserSign).toBe(true)
    })

    it('reports canUserSign false when the held participant is watch-only', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'P2', type: 'watch' } as WalletAccount,
        ])

        const { result } = renderHook(() => useImportSharedAccountScreen())

        // Membership is satisfied, but a watch-only participant cannot sign.
        expect(result.current.isUserIncluded).toBe(true)
        expect(result.current.canUserSign).toBe(false)
    })

    it('reports canUserSign false when no participant is held', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.isUserIncluded).toBe(false)
        expect(result.current.canUserSign).toBe(false)
    })

    it('flags and disables when the shared account is already imported', () => {
        mockUseAllAccounts.mockReturnValue([
            { address: SCANNED_ADDRESS, type: 'multisig' } as WalletAccount,
        ])

        const { result } = renderHook(() => useImportSharedAccountScreen())

        expect(result.current.isAlreadyImported).toBe(true)
        expect(result.current.isAddDisabled).toBe(true)
    })

    it('navigates to NameMultisig and clears the inbox invitation on add', () => {
        const { result } = renderHook(() => useImportSharedAccountScreen())

        result.current.handleAddAccount()

        expect(mockPush).toHaveBeenCalledWith('NameMultisig', {
            address: SCANNED_ADDRESS,
            threshold: 2,
            addresses: ['P1', 'P2', 'P3'],
            version: 1,
        })
        // Resolving the invitation clears it from the inbox, like Android.
        expect(mockDeleteImportInbox).toHaveBeenCalledWith({
            multisigAddress: SCANNED_ADDRESS,
        })
    })

    it('refetches on retry', () => {
        const { result } = renderHook(() => useImportSharedAccountScreen())

        result.current.handleRetry()

        expect(mockRefetch).toHaveBeenCalled()
    })

    it('dismisses the import flow on handleDismiss without touching the inbox', () => {
        const { result } = renderHook(() => useImportSharedAccountScreen())

        result.current.handleDismiss()

        expect(mockExitAccountFlow).toHaveBeenCalled()
        // The toolbar back arrow leaves silently — no inbox delete.
        expect(mockDeleteImportInbox).not.toHaveBeenCalled()
    })

    it('clears the inbox invitation then dismisses on handleIgnore', () => {
        const { result } = renderHook(() => useImportSharedAccountScreen())

        result.current.handleIgnore()

        expect(mockDeleteImportInbox).toHaveBeenCalledWith({
            multisigAddress: SCANNED_ADDRESS,
        })
        expect(mockExitAccountFlow).toHaveBeenCalled()
    })

    it('skips the inbox delete on handleIgnore when there is no device ID', () => {
        mockUseDeviceID.mockReturnValue(null)

        const { result } = renderHook(() => useImportSharedAccountScreen())

        result.current.handleIgnore()

        expect(mockDeleteImportInbox).not.toHaveBeenCalled()
        expect(mockExitAccountFlow).toHaveBeenCalled()
    })
})
