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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountInfoCard } from '../useAccountInfoCard'
import type {
    HDWalletAccount,
    HardwareWalletAccount,
    MultiSigAccount,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockNavigate = vi.fn()
vi.mock('@routes/navigationRef', () => ({
    navigationRef: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (params?.number != null)
                return key.replace('{{number}}', String(params.number))
            if (params?.count != null) return `${key} (${params.count})`
            return key
        },
    }),
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

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    microAlgosToAlgos: (v: bigint) => ({ toString: () => String(v) }),
}))

const hdAccount: HDWalletAccount = {
    type: 'hdWallet',
    address: 'HD_ADDR',
    keyPairId: 'key-1',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
}

const ledgerAccount: HardwareWalletAccount = {
    type: 'hardware',
    address: 'LEDGER_ADDR',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-abc',
        deviceName: 'My Ledger',
        accountIndex: 0,
        transportType: 'ble',
    },
}

const watchAccount: WalletAccount = {
    type: 'watch',
    address: 'WATCH_ADDR',
}

const multisigAccount: MultiSigAccount = {
    type: 'multisig',
    address: 'MULTISIG_ADDR',
    multisigDetails: {
        threshold: 2,
        addresses: ['ADDR_1', 'ADDR_2', 'ADDR_3'],
    },
}

describe('useAccountInfoCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAccountInformationQuery.mockReturnValue({
            data: { minBalance: BigInt(100_000) },
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
                    deviceId: 'device-abc',
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

    test('HD wallet account: showStructure true with wallet label and wallet icon', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: hdAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(true)
        expect(result.current.structureIcon).toBe('wallet')
        expect(result.current.structureLabel).toBe('account_info.wallet_label')
        expect(result.current.structureAccounts).toEqual([hdAccount])
    })

    test('Ledger account: showStructure true with deviceName and ledger icon', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: ledgerAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(true)
        expect(result.current.structureIcon).toBe('ledger')
        expect(result.current.structureLabel).toBe('My Ledger')
        expect(result.current.structureAccounts).toEqual([ledgerAccount])
    })

    test('Watch account: showStructure false', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: watchAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(false)
        expect(result.current.structureAccounts).toEqual([])
    })

    test('Multisig account: shows shared account details entry with participant count', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({
                account: multisigAccount,
                onClose: vi.fn(),
            }),
        )

        expect(result.current.accountTypeLabel).toBe(
            'account_info.type_multisig (3)',
        )
        expect(result.current.showSharedAccountDetails).toBe(true)
        expect(result.current.sharedAccountDetails).toEqual({
            participantCount: 3,
            threshold: 2,
            addresses: ['ADDR_1', 'ADDR_2', 'ADDR_3'],
        })
    })

    test('HD wallet handleScanAddresses navigates to SearchAccounts', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: hdAccount, onClose }),
        )
        act(() => {
            result.current.handleScanAddresses()
        })
        expect(onClose).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'SearchAccounts',
            params: { account: hdAccount, createIfEmpty: true },
        })
    })

    test('Ledger handleScanAddresses navigates to LedgerFetchAccounts with deviceId/deviceName', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: ledgerAccount, onClose }),
        )
        act(() => {
            result.current.handleScanAddresses()
        })
        expect(onClose).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'LedgerFetchAccounts',
            params: {
                deviceId: 'device-abc',
                deviceName: 'My Ledger',
                transportType: 'ble',
            },
        })
    })

    test('Watch handleScanAddresses is a no-op', () => {
        const onClose = vi.fn()
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: watchAccount, onClose }),
        )
        act(() => {
            result.current.handleScanAddresses()
        })
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    test('handleToggleExpanded toggles isExpanded', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: hdAccount, onClose: vi.fn() }),
        )
        expect(result.current.isExpanded).toBe(false)
        act(() => {
            result.current.handleToggleExpanded()
        })
        expect(result.current.isExpanded).toBe(true)
    })
})
