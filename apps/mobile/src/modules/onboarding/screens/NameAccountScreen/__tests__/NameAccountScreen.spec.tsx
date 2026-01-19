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

import { render, fireEvent, screen, waitFor } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { NameAccountScreen } from '../NameAccountScreen'

// Mock store functions
const mockSetShouldPlayConfetti = vi.fn()

// Mock useNavigation
const mockReplace = vi.fn()
const mockNavigate = vi.fn()

// Mock useRoute
vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: undefined }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        replace: mockReplace,
    }),
}))

// Mock hooks
const mockSetSelectedAccountAddress = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    useUpdateAccount: () => vi.fn(),
    useCreateAccount: () =>
        vi.fn().mockResolvedValue({ address: 'test-address' }),
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: null,
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
    getAccountDisplayName: () => 'Account 1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    WalletAccount: {} as any,
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useShouldPlayConfetti: () => ({
        shouldPlayConfetti: false,
        setShouldPlayConfetti: mockSetShouldPlayConfetti,
    }),
}))

describe('NameAccountScreen', () => {
    it('sets confetti state and triggers navigation on finish', async () => {
        render(<NameAccountScreen />)
        const button = screen.getByText('onboarding.name_account.finish_button')
        fireEvent.click(button)
        await waitFor(() => {
            expect(mockSetShouldPlayConfetti).toHaveBeenCalledWith(true)
            expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
                'test-address',
            )
        })
    })
})
