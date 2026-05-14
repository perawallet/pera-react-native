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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SelectHDWalletScreen } from '../SelectHDWalletScreen'
import type { HDWalletGroup } from '@perawallet/wallet-core-accounts'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockGoBack = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        push: mockPush,
        replace: mockReplace,
        goBack: mockGoBack,
    }),
}))

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}))

const mockCreateHdWalletAccount = vi.fn()

const mockHDWalletGroups: HDWalletGroup[] = [
    {
        seedKeyId: 'wallet-1',
        accounts: [],
        firstAccount: {
            id: 'hd-1',
            address: 'HD_ADDRESS_1',
            name: 'My Main Wallet',
            type: 'hdWallet' as const,
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9 as const,
            },
            keyPairId: 'wallet-1-acc0-idx0-dt9',
        },
        accountCount: 3,
    },
    {
        seedKeyId: 'wallet-2',
        accounts: [],
        firstAccount: {
            id: 'hd-2',
            address: 'HD_ADDRESS_2',
            type: 'hdWallet' as const,
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9 as const,
            },
            keyPairId: 'wallet-2-acc0-idx0-dt9',
        },
        accountCount: 1,
    },
]

const mockNewAccount = {
    id: 'hd-new',
    address: 'HD_NEW',
    type: 'hdWallet' as const,
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9 as const,
    },
    keyPairId: 'wallet-1-acc0-idx1-dt9',
}

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useHDWalletGroups: () => ({
            hdWalletGroups: mockHDWalletGroups,
            hasMultipleHDWallets: true,
        }),
        useAllAccounts: () => [], // <-- adicionar isto
        useCreateAccount: () => ({
            createHdWalletAccount: mockCreateHdWalletAccount,
        }),
        useAccountBalancesQuery: () => ({
            accountBalances: new Map(),
            portfolioAlgoValue: 0,
            isPending: false,
            isFetched: true,
            isRefetching: false,
            isError: false,
        }),
    }
})

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        deferToNextCycle: (callback: () => Promise<void>) => callback(),
    }
})

vi.mock('@components/CurrencyDisplay', () => ({
    CurrencyDisplay: ({ value }: { value?: { toString(): string } }) => (
        <div data-testid='currency-display'>{value?.toString()}</div>
    ),
}))

vi.mock('@components/PreferredCurrencyDisplay', () => ({
    PreferredCurrencyDisplay: ({
        sourceAmount,
    }: {
        sourceAmount?: { toString(): string }
    }) => (
        <div data-testid='preferred-currency-display'>
            {sourceAmount?.toString()}
        </div>
    ),
}))

describe('SelectHDWalletScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the title', () => {
        render(<SelectHDWalletScreen />)
        expect(
            screen.getByText('onboarding.select_hd_wallet.title'),
        ).toBeTruthy()
    })

    it('renders the description', () => {
        render(<SelectHDWalletScreen />)
        expect(
            screen.getByText('onboarding.select_hd_wallet.description'),
        ).toBeTruthy()
    })

    it('renders wallet items for each HD wallet group', () => {
        render(<SelectHDWalletScreen />)
        expect(screen.getByTestId('select_hd_wallet_item_0')).toBeTruthy()
        expect(screen.getByTestId('select_hd_wallet_item_1')).toBeTruthy()
    })

    it('displays wallet label for all wallets', () => {
        render(<SelectHDWalletScreen />)
        expect(
            screen.getAllByText('onboarding.select_hd_wallet.wallet_label'),
        ).toHaveLength(2)
    })

    it('displays account count for each wallet group', () => {
        render(<SelectHDWalletScreen />)
        expect(
            screen.getAllByText('onboarding.select_hd_wallet.account_count'),
        ).toHaveLength(2)
    })

    it('renders balance display for each wallet group', () => {
        render(<SelectHDWalletScreen />)
        expect(screen.getAllByTestId('currency-display')).toHaveLength(2)
        expect(
            screen.getAllByTestId('preferred-currency-display'),
        ).toHaveLength(2)
    })

    it('navigates to NameAccount with first account when wallet is tapped', async () => {
        mockCreateHdWalletAccount.mockResolvedValue(mockNewAccount)
        render(<SelectHDWalletScreen />)

        fireEvent.click(screen.getByTestId('select_hd_wallet_item_0'))

        await vi.waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: mockNewAccount,
            })
        })
    })

    it('navigates to NameAccount with correct wallet when second wallet is tapped', async () => {
        mockCreateHdWalletAccount.mockResolvedValue(mockNewAccount)
        render(<SelectHDWalletScreen />)

        fireEvent.click(screen.getByTestId('select_hd_wallet_item_1'))

        await vi.waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith('NameAccount', {
                account: mockNewAccount,
            })
        })
    })

    it('renders the create new wallet button', () => {
        render(<SelectHDWalletScreen />)
        expect(screen.getByTestId('select_hd_wallet_create_new')).toBeTruthy()
        expect(
            screen.getByText('onboarding.select_hd_wallet.create_new_wallet'),
        ).toBeTruthy()
    })

    it('shows loading overlay while creating a new wallet', async () => {
        let resolveCreate!: (value: unknown) => void
        mockCreateHdWalletAccount.mockReturnValue(
            new Promise(resolve => {
                resolveCreate = resolve
            }),
        )

        render(<SelectHDWalletScreen />)

        expect(
            screen.queryByText('onboarding.create_account.processing'),
        ).toBeNull()

        fireEvent.click(screen.getByTestId('select_hd_wallet_create_new'))

        await vi.waitFor(() => {
            expect(
                screen.getByText('onboarding.create_account.processing'),
            ).toBeTruthy()
        })

        resolveCreate({ id: 'new', address: 'NEW', type: 'hdWallet' })
    })

    it('hides loading overlay after wallet creation succeeds', async () => {
        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
        }
        mockCreateHdWalletAccount.mockResolvedValue(newAccount)

        render(<SelectHDWalletScreen />)

        fireEvent.click(screen.getByTestId('select_hd_wallet_create_new'))

        await vi.waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('NameAccount', {
                account: newAccount,
            })
        })

        expect(
            screen.queryByText('onboarding.create_account.processing'),
        ).toBeNull()
    })

    it('hides loading overlay after wallet creation fails', async () => {
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        render(<SelectHDWalletScreen />)

        fireEvent.click(screen.getByTestId('select_hd_wallet_create_new'))

        await vi.waitFor(() => {
            expect(mockShowToast).toHaveBeenCalled()
        })

        expect(
            screen.queryByText('onboarding.create_account.processing'),
        ).toBeNull()
    })

    it('creates a new HD wallet and navigates to NameAccount when create new wallet is tapped', async () => {
        const newAccount = {
            id: 'new-id',
            address: 'NEW_ADDRESS',
            type: 'hdWallet' as const,
        }
        mockCreateHdWalletAccount.mockResolvedValue(newAccount)

        render(<SelectHDWalletScreen />)

        fireEvent.click(screen.getByTestId('select_hd_wallet_create_new'))

        await vi.waitFor(() => {
            expect(mockCreateHdWalletAccount).toHaveBeenCalledWith({
                account: 0,
                keyIndex: 0,
            })
        })

        expect(mockPush).toHaveBeenCalledWith('NameAccount', {
            account: newAccount,
        })
    })

    it('shows error toast when create new wallet fails', async () => {
        mockCreateHdWalletAccount.mockRejectedValue(
            new Error('Creation failed'),
        )

        render(<SelectHDWalletScreen />)

        fireEvent.click(screen.getByTestId('select_hd_wallet_create_new'))

        await vi.waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'error' }),
            )
        })
    })
})
