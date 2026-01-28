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
import { ImportRekeyedAddressesScreen } from '../ImportRekeyedAddressesScreen'
import { AccountTypes } from '@perawallet/wallet-core-accounts'
import { OnboardingStackParamList } from '../../../routes/types'

vi.mock('@components/core', async () => {
    const actual = await vi.importActual<object>('@components/core')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { View } = await vi.importActual<any>('react-native')
    return {
        ...actual,
        PWFlatList: ({
            ListHeaderComponent,
            ListFooterComponent,
            data,
            renderItem,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }: any) => (
            <View>
                {ListHeaderComponent && <ListHeaderComponent />}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.map((item: any) => (
                    <View key={item.address}>{renderItem({ item })}</View>
                ))}
                {ListFooterComponent && <ListFooterComponent />}
            </View>
        ),
    }
})

describe('ImportRekeyedAddressesScreen', () => {
    beforeEach(() => {
        vi.mocked(useRoute).mockReturnValue({
            key: 'mock-key',
            name: 'ImportRekeyedAddresses',
            path: undefined,
            params: {
                accounts: [
                    {
                        id: '1',
                        address: 'MOCK_ADDRESS',
                        type: AccountTypes.algo25,
                        canSign: true,
                        rekeyAddress: 'REKEY_ADDRESS',
                    },
                ],
            },
        } as RouteProp<OnboardingStackParamList, 'ImportRekeyedAddresses'>)
    })

    it('renders the select rekeyed addresses title', () => {
        render(<ImportRekeyedAddressesScreen />)
        expect(
            screen.getByText('onboarding.import_rekeyed_addresses.title'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_rekeyed_addresses.continue'),
        ).toBeTruthy()
        expect(
            screen.getByText('onboarding.import_rekeyed_addresses.skip'),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.rekeyed_account_subtitle',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.description_line_1',
            ),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.description_line_2',
            ),
        ).toBeTruthy()
    })
})
