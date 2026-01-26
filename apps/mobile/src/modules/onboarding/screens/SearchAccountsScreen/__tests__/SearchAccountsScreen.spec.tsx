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

import { render, screen } from '@test-utils/render'
import { vi } from 'vitest'
import { RouteProp, useRoute } from '@react-navigation/native'
import { SearchAccountsScreen } from '../SearchAccountsScreen'
import { AccountTypes } from '@perawallet/wallet-core-accounts'
import { OnboardingStackParamList } from '../../../routes/types'

// Mock the hooks to avoid actual blockchain/KMS calls during tests
vi.mock('@perawallet/wallet-core-accounts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-accounts')>()),
    useHDWallet: () => ({
        deriveAccountAddress: vi.fn(),
    }),
    useCreateAccount: () => vi.fn(),
    discoverAccounts: vi.fn(() => Promise.resolve([])),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        getPrivateData: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => ({
        client: {
            algod: {
                accountInformation: vi.fn(() => ({})),

            },
        },
    }),
    encodeAlgorandAddress: vi.fn(() => 'MOCK_ADDRESS'),
}))

describe('SearchAccountsScreen', () => {
    beforeEach(() => {
        vi.mocked(useRoute).mockReturnValue({
            key: 'mock-key',
            name: 'SearchAccounts',
            path: undefined,
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
        } as RouteProp<OnboardingStackParamList, 'SearchAccounts'>)
    })

    it('renders searching accounts title', () => {
        render(<SearchAccountsScreen />)
        expect(
            screen.getByText('onboarding.searching_accounts.title'),
        ).toBeTruthy()
    })

    it('renders globe and phone icons', () => {
        render(<SearchAccountsScreen />)
        // Since RoundButtons are disabled, they might be harder to find by role,
        // but we can check if they are rendered.
        // PWIcon rendered globe and phone icons
        expect(screen.getByTestId('icon-globe')).toBeTruthy()
        expect(screen.getByTestId('icon-phone')).toBeTruthy()
    })
})

