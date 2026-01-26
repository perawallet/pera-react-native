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

import { renderHook, waitFor } from '@test-utils/render'
import { vi } from 'vitest'
import { useSearchAccountsScreen } from '../useSearchAccountsScreen'
import { AccountTypes } from '@perawallet/wallet-core-accounts'

const {
    mockShowToast,
    mockGoBack,
    mockReplace,
    mockGetPrivateData,
    mockDiscoverAccounts,
} = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockGoBack: vi.fn(),
    mockReplace: vi.fn(),
    mockGetPrivateData: vi.fn(),
    mockDiscoverAccounts: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
        replace: mockReplace,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        getPrivateData: mockGetPrivateData,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    discoverAccounts: mockDiscoverAccounts,
    getSeedFromMasterKey: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: vi.fn(),
            },
        },
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: {
            account: {
                id: '1',
                address: 'MOCK_ADDRESS',
                type: AccountTypes.hdWallet,
                canSign: true,
                hdWalletDetails: {
                    walletId: '1',
                    account: 0,
                    change: 0,
                    keyIndex: 0,
                    derivationType: 9,
                },
            },
        },
    }),
}))

describe('useSearchAccountsScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default success mocks
        mockGetPrivateData.mockResolvedValue(new Uint8Array(32))
        mockDiscoverAccounts.mockResolvedValue([])
    })

    it('navigates back and shows toast on error', async () => {
        mockDiscoverAccounts.mockRejectedValue(new Error('Search failed'))

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith({
                type: 'error',
                title: 'onboarding.import_account.failed_title',
                body: 'onboarding.import_account.failed_body',
            })
            expect(mockGoBack).toHaveBeenCalled()
        })
    })

    it('navigates to ImportSelectAddresses on success', async () => {
        mockDiscoverAccounts.mockResolvedValue([])

        renderHook(() => useSearchAccountsScreen())

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('ImportSelectAddresses', {
                accounts: expect.any(Array),
            })
        })
    })
})
