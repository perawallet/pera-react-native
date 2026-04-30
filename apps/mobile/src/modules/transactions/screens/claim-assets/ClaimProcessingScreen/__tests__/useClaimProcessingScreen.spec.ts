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

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
    useRoute: () => ({
        params: {
            mode: 'claimArc59' as const,
            assetIndex: 0,
            shouldClaimAlgo: false,
        },
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

const { mockShowToast } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({
        getMessage: (_err: unknown) => ({ title: 'Error', body: 'error body' }),
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useFindAccountByAddress: vi.fn(() => ({
            address: 'test-address',
            name: 'Test',
        })),
        useAccountBalancesInvalidator: vi.fn(() => ({ invalidate: vi.fn() })),
    }
})

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        assetRequests: [
            {
                asset: {
                    assetId: '123',
                    name: 'Test Asset',
                    decimals: 0,
                    totalSupply: new Decimal(1),
                    creator: { address: 'CREATOR' },
                },
            },
        ],
        accountAddress: 'test-address',
        setOnFinished: vi.fn(),
    }),
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
    })

    it('calls navigation.goBack and does not show an error toast when user cancels the signing overlay', async () => {
        mockExecute.mockRejectedValueOnce(new UserRejectedSigningError())

        renderHook(() => useClaimProcessingScreen())

        // Allow microtasks to flush
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockGoBack).toHaveBeenCalled()
        expect(mockShowToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
        )
    })

    it('shows an error toast and navigates back when execution fails with a non-cancel error', async () => {
        mockExecute.mockRejectedValueOnce(new Error('Network error'))

        renderHook(() => useClaimProcessingScreen())

        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'error' }),
            expect.anything(),
        )
        expect(mockGoBack).toHaveBeenCalled()
    })
})
