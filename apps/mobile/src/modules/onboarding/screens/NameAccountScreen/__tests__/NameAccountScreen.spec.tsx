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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NameAccountScreen } from '../NameAccountScreen'

const mockSetShouldPlayConfetti = vi.fn()
const mockExitAccountFlow = vi.fn()
const mockReplace = vi.fn()
const mockNavigate = vi.fn()
const mockSetSelectedAccountAddress = vi.fn()
const mockUpdateAccount = vi.fn()
const mockCreateHdWalletAccount = vi
    .fn()
    .mockResolvedValue({ address: 'test-address' })

let mockRouteParams: { account?: unknown } | undefined

vi.mock('@react-navigation/native', async () => {
    const actual = await vi.importActual<object>('@react-navigation/native')
    return {
        ...actual,
        useRoute: () => ({ params: mockRouteParams }),
    }
})

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
        replace: mockReplace,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => [],
    useAccountAuthAddresses: () => ({
        authAddresses: new Map<string, string | null>(),
        isPending: false,
        isFetched: true,
    }),
    useUpdateAccount: () => mockUpdateAccount,
    useCreateAccount: () => ({
        createHdWalletAccount: mockCreateHdWalletAccount,
    }),
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: null,
        setSelectedAccountAddress: mockSetSelectedAccountAddress,
    }),
    getAccountDisplayName: (account: { name?: string }) =>
        account?.name ?? 'Account 1',
    resolveAccountStatus: () => 'standard',
    isHDWalletAccount: () => false,
    isAlgo25Account: () => false,
    isLedgerAccount: () => false,
    isWatchAccount: (account: { type: string }) => account?.type === 'watch',
    isMultisigAccount: () => false,
    isRekeyedAccount: () => false,
    WalletAccount: {} as unknown,
}))

vi.mock('@modules/onboarding/hooks', () => ({
    useShouldPlayConfetti: () => ({
        shouldPlayConfetti: false,
        setShouldPlayConfetti: mockSetShouldPlayConfetti,
    }),
    useExitAccountFlow: () => ({
        exitAccountFlow: mockExitAccountFlow,
    }),
}))

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<object>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string) => key,
            i18n: { changeLanguage: vi.fn(), language: 'en' },
        }),
    }
})

describe('NameAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRouteParams = undefined
        mockCreateHdWalletAccount.mockResolvedValue({
            address: 'test-address',
        })
    })

    it('renders the title and description', () => {
        render(<NameAccountScreen />)

        expect(screen.getByText('onboarding.name_account.title')).toBeTruthy()
        expect(
            screen.getByText('onboarding.name_account.description'),
        ).toBeTruthy()
    })

    it('renders the name input and finish button', () => {
        render(<NameAccountScreen />)

        expect(screen.getByTestId('name_account_name_input')).toBeTruthy()
        expect(
            screen.getByText('onboarding.name_account.finish_button'),
        ).toBeTruthy()
    })

    it('allows editing the account name', () => {
        render(<NameAccountScreen />)

        const input = screen.getByTestId('name_account_name_input')
        fireEvent.change(input, { target: { value: 'My Custom Name' } })

        expect((input as HTMLInputElement).value).toBe('My Custom Name')
    })

    it('sets confetti state and triggers navigation on finish', async () => {
        render(<NameAccountScreen />)
        const button = screen.getByText('onboarding.name_account.finish_button')
        fireEvent.click(button)
        await waitFor(() => {
            expect(mockSetShouldPlayConfetti).toHaveBeenCalledWith(true)
            expect(mockExitAccountFlow).toHaveBeenCalled()
            expect(mockSetSelectedAccountAddress).toHaveBeenCalledWith(
                'test-address',
            )
        })
    })

    it('updates existing account name on finish when account is provided', async () => {
        mockRouteParams = {
            account: {
                id: '1',
                address: 'EXISTING_ADDR',
                type: 'hdWallet',
                name: 'Original',
                keyPairId: 'kp1',
            },
        }

        render(<NameAccountScreen />)

        const input = screen.getByTestId('name_account_name_input')
        fireEvent.change(input, { target: { value: 'Renamed' } })

        const button = screen.getByText('onboarding.name_account.finish_button')
        fireEvent.click(button)

        await waitFor(() => {
            expect(mockUpdateAccount).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Renamed',
                    address: 'EXISTING_ADDR',
                }),
            )
            expect(mockCreateHdWalletAccount).not.toHaveBeenCalled()
        })
    })
})
