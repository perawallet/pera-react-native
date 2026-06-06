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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useClaimProcessingScreen } from '../useClaimProcessingScreen'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { Decimal } from 'decimal.js'

const mockGoBack = vi.fn()
const mockReplace = vi.fn()

const { mockRouteParams } = vi.hoisted(() => ({
    mockRouteParams: {
        mode: 'claimArc59' as string,
        assetIndex: 0,
        shouldClaimAlgo: false,
    },
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
    useRoute: () => ({
        params: mockRouteParams,
    }),
}))

vi.mock('@react-navigation/native-stack', () => ({}))

const { mockExecute } = vi.hoisted(() => ({
    mockExecute: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionSendFlow: () => ({
        execute: mockExecute,
    }),
}))

const { mockShowError } = vi.hoisted(() => ({
    mockShowError: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

const { mockUseFindAccountByAddress, mockUseClaimAssets } = vi.hoisted(() => ({
    mockUseFindAccountByAddress: vi.fn(),
    mockUseClaimAssets: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useFindAccountByAddress: mockUseFindAccountByAddress,
        useAccountBalancesInvalidator: vi.fn(() => ({ invalidate: vi.fn() })),
    }
})

const defaultAssetRequest = {
    asset: {
        assetId: '123',
        name: 'Test Asset',
        decimals: 0,
        totalSupply: new Decimal(1),
        creator: { address: 'CREATOR' },
    },
}

const defaultAccount = { address: 'test-address', name: 'Test' }

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: mockUseClaimAssets,
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@perawallet/wallet-core-asa-inbox', () => ({
    useArc59Invalidator: () => ({ remove: vi.fn() }),
}))

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxInvalidator: () => ({ invalidate: vi.fn() }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ replace: vi.fn() }),
}))

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    },
}))

describe('useClaimProcessingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams.mode = 'claimArc59'
        mockRouteParams.assetIndex = 0
        mockRouteParams.shouldClaimAlgo = false
        mockUseFindAccountByAddress.mockReturnValue(defaultAccount)
        mockUseClaimAssets.mockReturnValue({
            assetRequests: [defaultAssetRequest],
            accountAddress: 'test-address',
            setOnFinished: vi.fn(),
        })
    })

    describe('claimArc59 mode', () => {
        it('navigates to ClaimSuccess with variant "claim" on successful execution', async () => {
            mockExecute.mockResolvedValueOnce('tx-id-123')

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockReplace).toHaveBeenCalledWith('ClaimSuccess', {
                transactionId: 'tx-id-123',
                variant: 'claim',
            })
        })

        it('calls navigation.goBack and does not show an error toast when user cancels the signing overlay', async () => {
            mockExecute.mockRejectedValueOnce(new UserRejectedSigningError())

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockGoBack).toHaveBeenCalled()
            expect(mockShowError).not.toHaveBeenCalled()
        })

        it('shows an error toast and navigates back when execution fails with a non-cancel error', async () => {
            const executeError = new Error('Network error')
            mockExecute.mockRejectedValueOnce(executeError)

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockShowError).toHaveBeenCalledWith(
                executeError,
                undefined,
                expect.anything(),
            )
            expect(mockGoBack).toHaveBeenCalled()
        })
    })

    describe('rejectArc59 mode', () => {
        beforeEach(() => {
            mockRouteParams.mode = 'rejectArc59'
        })

        it('navigates to ClaimSuccess with variant "reject" on successful execution', async () => {
            mockExecute.mockResolvedValueOnce('tx-id-456')

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockReplace).toHaveBeenCalledWith('ClaimSuccess', {
                transactionId: 'tx-id-456',
                variant: 'reject',
            })
        })

        it('calls navigation.goBack and does not show an error toast when user cancels', async () => {
            mockExecute.mockRejectedValueOnce(new UserRejectedSigningError())

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockGoBack).toHaveBeenCalled()
            expect(mockShowError).not.toHaveBeenCalled()
        })

        it('shows an error toast and navigates back when execution fails', async () => {
            const executeError = new Error('Reject failed')
            mockExecute.mockRejectedValueOnce(executeError)

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockShowError).toHaveBeenCalledWith(
                executeError,
                undefined,
                expect.anything(),
            )
            expect(mockGoBack).toHaveBeenCalled()
        })
    })

    describe('null guard', () => {
        it('navigates back immediately without calling execute when asset is not found', async () => {
            mockUseClaimAssets.mockReturnValue({
                assetRequests: [],
                accountAddress: 'test-address',
                setOnFinished: vi.fn(),
            })

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockGoBack).toHaveBeenCalled()
            expect(mockExecute).not.toHaveBeenCalled()
        })

        it('navigates back immediately without calling execute when account is not found', async () => {
            mockUseFindAccountByAddress.mockReturnValue(undefined)

            renderHook(() => useClaimProcessingScreen())

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(mockGoBack).toHaveBeenCalled()
            expect(mockExecute).not.toHaveBeenCalled()
        })
    })
})
