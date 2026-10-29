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

import { renderHook, waitFor } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useClaimProcessingScreen } from '../useClaimProcessingScreen'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM_CHAIN_ID } from '@test-utils/chain-fixtures'

const ALGORAND_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

const mockGoBack = vi.fn()
const mockReplace = vi.fn()

const { mockRouteParams } = vi.hoisted(() => ({
    mockRouteParams: {
        mode: 'claim' as 'claim' | 'reject',
        assetIndex: 0,
        shouldClaimAlgo: false,
        scope: { chainId: 'algorand', networkId: 'mainnet' } as ChainScope,
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

const { mockExecute, mockUseTransactionSendFlow } = vi.hoisted(() => {
    const mockExecute = vi.fn()
    return {
        mockExecute,
        mockUseTransactionSendFlow: vi.fn(() => ({ execute: mockExecute })),
    }
})

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransactionSendFlow: mockUseTransactionSendFlow,
    useAssetInboxInvalidator: () => ({ remove: vi.fn() }),
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
    totalAmount: new Decimal(250),
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
        mockRouteParams.mode = 'claim'
        mockRouteParams.assetIndex = 0
        mockRouteParams.shouldClaimAlgo = false
        mockRouteParams.scope = ALGORAND_SCOPE
        mockUseFindAccountByAddress.mockReturnValue(defaultAccount)
        mockUseClaimAssets.mockReturnValue({
            assetRequests: [defaultAssetRequest],
            accountAddress: 'test-address',
            setOnFinished: vi.fn(),
        })
    })

    it.each([
        ['Algorand', ALGORAND_SCOPE],
        ['Ethereum', { chainId: ETHEREUM_CHAIN_ID, networkId: 'sepolia' }],
    ])(
        'resolves the account and sends on the %s scope it was opened for',
        (_, scope) => {
            mockRouteParams.scope = scope as ChainScope
            mockExecute.mockResolvedValueOnce('tx-id-123')

            renderHook(() => useClaimProcessingScreen())

            expect(mockUseFindAccountByAddress).toHaveBeenCalledWith(
                'test-address',
                scope,
            )
            expect(mockUseTransactionSendFlow).toHaveBeenCalledWith(scope)
        },
    )

    it('passes the claimed amount to the send flow so it can credit optimistically', () => {
        mockExecute.mockResolvedValueOnce('tx-id-123')

        renderHook(() => useClaimProcessingScreen())

        expect(mockExecute).toHaveBeenCalledWith({
            params: expect.objectContaining({
                amount: new Decimal(250),
            }),
        })
    })

    describe.each([
        ['claim', 'claimAssetInbox'],
        ['reject', 'rejectAssetInbox'],
    ] as const)('%s mode', (mode, sendMode) => {
        beforeEach(() => {
            mockRouteParams.mode = mode
        })

        it(`asks the send flow for ${sendMode}`, () => {
            mockExecute.mockResolvedValueOnce('tx-id-123')

            renderHook(() => useClaimProcessingScreen())

            expect(mockExecute).toHaveBeenCalledWith({
                params: expect.objectContaining({ sendMode }),
            })
        })

        it(`navigates to ClaimSuccess with variant "${mode}" on successful execution`, async () => {
            mockExecute.mockResolvedValueOnce('tx-id-123')

            renderHook(() => useClaimProcessingScreen())

            await waitFor(() =>
                expect(mockReplace).toHaveBeenCalledWith('ClaimSuccess', {
                    transactionId: 'tx-id-123',
                    variant: mode,
                }),
            )
        })

        it('goes back without an error toast when the user cancels the signing overlay', async () => {
            mockExecute.mockRejectedValueOnce(new UserRejectedSigningError())

            renderHook(() => useClaimProcessingScreen())

            await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
            expect(mockShowError).not.toHaveBeenCalled()
        })

        it('shows an error toast and goes back when execution fails', async () => {
            const executeError = new Error('Network error')
            mockExecute.mockRejectedValueOnce(executeError)

            renderHook(() => useClaimProcessingScreen())

            await waitFor(() => expect(mockGoBack).toHaveBeenCalled())
            expect(mockShowError).toHaveBeenCalledWith(
                executeError,
                undefined,
                expect.anything(),
            )
        })
    })

    describe('null guard', () => {
        it('navigates back immediately without calling execute when asset is not found', () => {
            mockUseClaimAssets.mockReturnValue({
                assetRequests: [],
                accountAddress: 'test-address',
                setOnFinished: vi.fn(),
            })

            renderHook(() => useClaimProcessingScreen())

            expect(mockGoBack).toHaveBeenCalled()
            expect(mockExecute).not.toHaveBeenCalled()
        })

        it('navigates back immediately without calling execute when account is not found', () => {
            mockUseFindAccountByAddress.mockReturnValue(undefined)

            renderHook(() => useClaimProcessingScreen())

            expect(mockGoBack).toHaveBeenCalled()
            expect(mockExecute).not.toHaveBeenCalled()
        })
    })
})
