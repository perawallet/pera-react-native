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

import { render, fireEvent, screen } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NameAccountScreen } from '../NameAccountScreen'
import { NativeStackScreenProps } from '@react-navigation/native-stack'
import { OnboardingStackParamList } from '../../routes'


// Mock useNavigation
const mockReplace = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useNavigation: () => ({
            navigate: mockNavigate,
            replace: mockReplace,
        }),
    }
})

// Mock hooks
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    useUpdateAccount: () => vi.fn(),
    getAccountDisplayName: () => 'Account 1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WalletAccount: {} as any,
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: () => ({
        deletePreference: vi.fn(),
    }),
}))

const mockRoute = {
    params: {
        account: {
            name: 'Account 1',
            address: 'ALGOREADDRESS',
        },
    },
    key: 'NameAccount',
    name: 'NameAccount',
} as unknown as NativeStackScreenProps<OnboardingStackParamList, 'NameAccount'>['route']

const mockProps = {
    route: mockRoute,
    navigation: {
        replace: mockReplace,
        navigate: mockNavigate,
    } as any,
}

describe('NameAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly', () => {
        render(<NameAccountScreen {...mockProps} />)
        expect(screen.getByText('onboarding.name_account.title')).toBeTruthy()
        expect(screen.getByText('onboarding.name_account.description')).toBeTruthy()
        expect(
            screen.getByText('onboarding.name_account.finish_button'),
        ).toBeTruthy()
    })

    it('updates name input', () => {
        render(<NameAccountScreen {...mockProps} />)
        const input = screen.getByRole('textbox') as HTMLInputElement
        fireEvent.change(input, { target: { value: 'New Name' } })
        expect(input.value).toBe('New Name')
    })

    it('navigates to Home on finish', () => {
        render(<NameAccountScreen {...mockProps} />)
        const button = screen.getByText('onboarding.name_account.finish_button')
        fireEvent.click(button)
        expect(mockReplace).toHaveBeenCalledWith('TabBar', {
            screen: 'Home',
            params: {
                screen: 'AccountDetails',
                params: { playConfetti: true },
            },
        })
    })
})
