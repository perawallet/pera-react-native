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
import { ImportSelectAddressesScreen } from '../ImportSelectAddressesScreen'
import { AccountTypes } from '@perawallet/wallet-core-accounts'
import { OnboardingStackParamList } from '../../../routes/types'

describe('ImportSelectAddressesScreen', () => {
    beforeEach(() => {
        vi.mocked(useRoute).mockReturnValue({
            key: 'mock-key',
            name: 'ImportSelectAddresses',
            path: undefined,
            params: {
                accounts: [
                    {
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
                ],
            },
        } as RouteProp<OnboardingStackParamList, 'ImportSelectAddresses'>)
    })

    it('renders the select addresses title', () => {
        render(<ImportSelectAddressesScreen />)
        expect(
            screen.getByText('onboarding.import_select_addresses.title'),
        ).toBeTruthy()
    })
})
