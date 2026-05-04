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

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'
import { AccountInfoCard } from '../AccountInfoCard'
import {
    HDWalletAccount,
    HardwareWalletAccount,
    MultiSigAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

const mockNavigate = vi.fn()

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params?.number != null)
                return key.replace('{{number}}', String(params.number))
            if (params?.count != null) return `${key} (${String(params.count)})`
            return key
        },
    }),
}))

vi.mock('@routes/navigationRef', () => ({
    navigationRef: {
        navigate: (...args: unknown[]) => mockNavigate(...args),
    },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: (...args: unknown[]) => mockNavigate(...args),
    }),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: () => false,
}))

vi.mock('@components/core', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWView: ({ children, style, testID }: any) => (
        <div
            style={style}
            data-testid={testID}
        >
            {children}
        </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWText: ({ children, style, testID }: any) => (
        <span
            style={style}
            data-testid={testID}
        >
            {children}
        </span>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PWTouchableOpacity: ({ children, onPress, style, testID }: any) => (
        <button
            onClick={onPress}
            style={style}
            data-testid={testID}
        >
            {children}
        </button>
    ),
    PWDivider: () => <hr />,
    PWIcon: () => null,
    PWRoundIcon: () => null,
}))

vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: ({
        address,
        testID,
    }: {
        address: string
        testID: string
    }) => <div data-testid={testID}>{address}</div>,
}))

vi.mock('@components/CurrencyDisplay', () => ({
    CurrencyDisplay: ({
        value,
        isLoading,
    }: {
        value: Nullable<Decimal>
        isLoading: boolean
    }) => (
        <span data-testid='currency-display'>
            {isLoading ? 'loading' : (value?.toString() ?? '---')}
        </span>
    ),
}))

vi.mock('@components/ExpandablePanel', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ExpandablePanel: ({ children, isExpanded }: any) =>
        isExpanded ? (
            <div data-testid='expandable-panel'>{children}</div>
        ) : null,
}))

vi.mock('react-native-reanimated', () => ({
    default: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        View: ({ children, style }: any) => <div style={style}>{children}</div>,
    },
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (value: unknown) => value,
}))

vi.mock('@constants/ui', () => ({
    EXPANDABLE_PANEL_ANIMATION_DURATION: 300,
}))

vi.mock('../AccountIcon', () => ({
    AccountIcon: () => <span data-testid='account-icon' />,
}))

vi.mock('@components/InfoButton', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    InfoButton: ({ children, title }: any) => (
        <div data-testid='info-button'>
            {title && <span>{title}</span>}
            {children}
        </div>
    ),
}))

vi.mock('../AccountTypeInfoContent', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AccountTypeInfoContent: ({ account }: any) => (
        <div data-testid='account-type-info-content'>{account.type}</div>
    ),
}))

vi.mock('../SharedAccountDetailsBottomSheet', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SharedAccountDetailsBottomSheet: ({ isVisible, details }: any) =>
        isVisible && details ? (
            <div data-testid='shared_account_details_content'>
                {details.addresses.map((address: string) => (
                    <span
                        key={address}
                        data-testid={`shared_account_participant_${address}`}
                    >
                        {address}
                    </span>
                ))}
            </div>
        ) : null,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    microAlgosToAlgos: (v: bigint) => new Decimal(Number(v) / 1_000_000),
}))

const mockUseAccountInformationQuery = vi.fn()
const mockUseHDWalletGroups = vi.fn()
const mockUseLedgerDeviceGroups = vi.fn()
const mockUseAccountLogicalType = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...actual,
        useAccountInformationQuery: (...args: unknown[]) =>
            mockUseAccountInformationQuery(...args),
        useHDWalletGroups: () => mockUseHDWalletGroups(),
        useLedgerDeviceGroups: () => mockUseLedgerDeviceGroups(),
        useAccountLogicalType: (...args: unknown[]) =>
            mockUseAccountLogicalType(...args),
    }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        truncateAlgorandAddress: (addr: string) =>
            addr.length > 8 ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : addr,
    }
})

const hdAccount: HDWalletAccount = {
    type: 'hdWallet',
    address: 'CJR5ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890NZNS',
    keyPairId: 'key-1',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
    name: 'Main Address',
}

const watchAccount: WalletAccount = {
    type: 'watch',
    address: 'WATCHADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
}

const ledgerAccount: HardwareWalletAccount = {
    type: 'hardware',
    address: 'LEDGERADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-xyz',
        deviceName: 'My Ledger',
        accountIndex: 0,
    },
    name: 'Cold Wallet',
}

const multisigAccount: MultiSigAccount = {
    type: 'multisig',
    address: 'MULTISIGADDR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    name: 'Shared Account #1',
    multisigDetails: {
        threshold: 2,
        addresses: ['PARTICIPANT_1', 'PARTICIPANT_2', 'PARTICIPANT_3'],
    },
}

describe('AccountInfoCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountInformationQuery.mockReturnValue({
            data: { minBalance: BigInt(6_095_000) },
            isLoading: false,
        })
        mockUseHDWalletGroups.mockReturnValue({
            hdWalletGroups: [
                {
                    keyPairId: 'key-1',
                    accounts: [hdAccount],
                    firstAccount: hdAccount,
                    accountCount: 1,
                },
            ],
            hasMultipleHDWallets: false,
        })
        mockUseLedgerDeviceGroups.mockReturnValue({
            ledgerDeviceGroups: [
                {
                    deviceId: 'device-xyz',
                    deviceName: 'My Ledger',
                    accounts: [ledgerAccount],
                    firstAccount: ledgerAccount,
                    accountCount: 1,
                },
            ],
            hasMultipleLedgerDevices: false,
        })
        mockUseAccountLogicalType.mockImplementation((address: string) => {
            if (address === hdAccount.address) return 'HdKey'
            if (address === ledgerAccount.address) return 'LedgerBle'
            if (address === watchAccount.address) return 'NoAuth'
            if (address === multisigAccount.address) return 'Multisig'
            return null
        })
    })

    it('renders account type label for HD wallet account', () => {
        render(
            <AccountInfoCard
                account={hdAccount}
                onClose={vi.fn()}
            />,
        )
        expect(
            screen.getByText('account_info.type_universal_wallet'),
        ).toBeTruthy()
    })

    it('renders account type label for watch account', () => {
        render(
            <AccountInfoCard
                account={watchAccount}
                onClose={vi.fn()}
            />,
        )
        expect(screen.getByText('account_info.type_watch')).toBeTruthy()
    })

    it('renders min balance', () => {
        render(
            <AccountInfoCard
                account={hdAccount}
                onClose={vi.fn()}
            />,
        )
        expect(screen.getByTestId('currency-display')).toBeTruthy()
    })

    it('shows wallet structure toggle for HD wallet accounts', () => {
        render(
            <AccountInfoCard
                account={hdAccount}
                onClose={vi.fn()}
            />,
        )
        expect(
            screen.getByText('account_info.see_wallet_structure'),
        ).toBeTruthy()
    })

    it('does not show wallet structure toggle for non-HD accounts', () => {
        render(
            <AccountInfoCard
                account={watchAccount}
                onClose={vi.fn()}
            />,
        )
        expect(
            screen.queryByText('account_info.see_wallet_structure'),
        ).toBeNull()
    })

    it('shows wallet structure tree when expanded', () => {
        render(
            <AccountInfoCard
                account={hdAccount}
                onClose={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText('account_info.see_wallet_structure'))
        expect(screen.getByTestId('expandable-panel')).toBeTruthy()
        expect(screen.getByText('account_info.wallet_label')).toBeTruthy()
    })

    it('shows loading state for min balance', () => {
        mockUseAccountInformationQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
        })
        render(
            <AccountInfoCard
                account={hdAccount}
                onClose={vi.fn()}
            />,
        )
        expect(screen.getByText('loading')).toBeTruthy()
    })

    it('renders account type info content via InfoButton', () => {
        render(
            <AccountInfoCard
                account={hdAccount}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByTestId('account-type-info-content')).toBeTruthy()
    })

    it('renders min balance info via InfoButton with title', () => {
        render(
            <AccountInfoCard
                account={hdAccount}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByText('min_balance_info.title')).toBeTruthy()
        expect(screen.getByText('min_balance_info.description')).toBeTruthy()
    })

    it('does not show min balance InfoButton for watch accounts', () => {
        render(
            <AccountInfoCard
                account={watchAccount}
                onClose={vi.fn()}
            />,
        )

        expect(screen.queryByText('min_balance_info.description')).toBeNull()
    })

    it('shows wallet structure toggle for Ledger accounts', () => {
        render(
            <AccountInfoCard
                account={ledgerAccount}
                onClose={vi.fn()}
            />,
        )
        expect(
            screen.getByText('account_info.see_wallet_structure'),
        ).toBeTruthy()
    })

    it('renders Ledger device name in expanded structure', () => {
        render(
            <AccountInfoCard
                account={ledgerAccount}
                onClose={vi.fn()}
            />,
        )
        fireEvent.click(screen.getByText('account_info.see_wallet_structure'))
        expect(screen.getByTestId('expandable-panel')).toBeTruthy()
        expect(screen.getByText('My Ledger')).toBeTruthy()
    })

    it('renders account type label for Ledger account', () => {
        render(
            <AccountInfoCard
                account={ledgerAccount}
                onClose={vi.fn()}
            />,
        )
        expect(screen.getByText('account_info.type_ledger')).toBeTruthy()
    })

    it('renders shared account count for multisig accounts', () => {
        render(
            <AccountInfoCard
                account={multisigAccount}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByText('account_info.type_multisig (3)')).toBeTruthy()
    })

    it('opens the shared account details bottom sheet when multisig account type row is pressed', () => {
        const onClose = vi.fn()
        render(
            <AccountInfoCard
                account={multisigAccount}
                onClose={onClose}
            />,
        )

        expect(
            screen.queryByTestId('shared_account_details_content'),
        ).toBeNull()

        fireEvent.click(screen.getByTestId('shared_account_details_button'))

        expect(onClose).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(
            screen.getByTestId('shared_account_details_content'),
        ).toBeTruthy()
        expect(screen.getByText('PARTICIPANT_1')).toBeTruthy()
        expect(screen.getByText('PARTICIPANT_2')).toBeTruthy()
        expect(screen.getByText('PARTICIPANT_3')).toBeTruthy()
    })
})
