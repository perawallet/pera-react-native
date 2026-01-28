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

import { render, screen, fireEvent } from '@test-utils/render'
import { vi } from 'vitest'
import { ImportRekeyedAddressesScreen } from '../ImportRekeyedAddressesScreen'
import { useImportRekeyedAddressesScreen } from '../useImportRekeyedAddressesScreen'
import { AccountTypes } from '@perawallet/wallet-core-accounts'

// Mock the hook
vi.mock('../useImportRekeyedAddressesScreen', () => ({
    useImportRekeyedAddressesScreen: vi.fn(),
}))

vi.mock('@components/core', async () => {
    const actual = await vi.importActual<object>('@components/core')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { View, Text } = await vi.importActual<any>('react-native')
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
        PWLoadingOverlay: ({ isVisible, title }: any) =>
            isVisible ? <Text>{title}</Text> : null,
    }
})

describe('ImportRekeyedAddressesScreen', () => {
    const mockHandleContinue = vi.fn()
    const mockHandleSkip = vi.fn()
    const mockToggleSelection = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useImportRekeyedAddressesScreen).mockReturnValue({
            accounts: [
                {
                    id: '1',
                    address: 'MOCK_ADDRESS',
                    type: AccountTypes.algo25,
                    canSign: true,
                    rekeyAddress: 'REKEY_ADDRESS',
                },
            ],
            selectedAddresses: new Set(),
            canContinue: false,
            isImporting: false,
            alreadyImportedAddresses: new Set(),
            toggleSelection: mockToggleSelection,
            handleContinue: mockHandleContinue,
            handleSkip: mockHandleSkip,
            t: (key: string) => key,
            isAllSelected: false,
            areAllImported: false,
            toggleSelectAll: vi.fn(),
        })
    })

    it('renders the select rekeyed addresses title', () => {
        render(<ImportRekeyedAddressesScreen />)
        expect(
            screen.getByText('onboarding.import_rekeyed_addresses.title'),
        ).toBeTruthy()
    })

    it('shows loading overlay when isImporting is true', () => {
        vi.mocked(useImportRekeyedAddressesScreen).mockReturnValue({
            ...vi.mocked(useImportRekeyedAddressesScreen)(),
            isImporting: true,
        })

        render(<ImportRekeyedAddressesScreen />)
        expect(
            screen.getByText(
                'onboarding.import_rekeyed_addresses.importing_accounts',
            ),
        ).toBeTruthy()
    })

    it('handles interactions via hook callbacks', () => {
        render(<ImportRekeyedAddressesScreen />)

        // Test toggle
        fireEvent.click(screen.getByText('MOCK_ADDRESS'))
        expect(mockToggleSelection).toHaveBeenCalledWith('MOCK_ADDRESS')

        // Test skip
        fireEvent.click(
            screen.getByText('onboarding.import_rekeyed_addresses.skip'),
        )
        expect(mockHandleSkip).toHaveBeenCalled()
        
        // Test continue (disabled by default in mock, verify it's disabled or enabled logic in hook tests)
    })
})
