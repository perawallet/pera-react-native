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
    RekeyTransition,
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
const mockUseRekeyTransition = vi.fn<() => RekeyTransition | null>()

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
        useRekeyTransition: () => mockUseRekeyTransition(),
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
        mockUseRekeyTransition.mockReturnValue(null)
    })

    test('HD wallet account: showStructure true with wallet label and wallet icon', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: hdAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(true)
        expect(result.current.structureIcon).toBe('wallet')
        expect(result.current.structureLabel).toBe('account_info.wallet_label')
        expect(result.current.structureAccounts).toEqual([hdAccount])
        expect(result.current.structureMainAddress).toBe(hdAccount.address)
    })

    test('Ledger account: showStructure true with deviceName and ledger icon', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: ledgerAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(true)
        expect(result.current.structureIcon).toBe('ledger')
        expect(result.current.structureLabel).toBe('My Ledger')
        expect(result.current.structureAccounts).toEqual([ledgerAccount])
        expect(result.current.structureMainAddress).toBe(ledgerAccount.address)
    })

    test('Ledger account with sub-addresses: structureMainAddress is the firstAccount address', () => {
        const subLedgerAccount: HardwareWalletAccount = {
            type: 'hardware',
            address: 'LEDGER_SUB_ADDR',
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'device-abc',
                deviceName: 'My Ledger',
                accountIndex: 1,
                transportType: 'ble',
            },
        }
        mockUseLedgerDeviceGroups.mockReturnValueOnce({
            ledgerDeviceGroups: [
                {
                    deviceId: 'device-abc',
                    deviceName: 'My Ledger',
                    accounts: [ledgerAccount, subLedgerAccount],
                    firstAccount: ledgerAccount,
                    accountCount: 2,
                },
            ],
            hasMultipleLedgerDevices: false,
        })
        const { result } = renderHook(() =>
            useAccountInfoCard({
                account: subLedgerAccount,
                onClose: vi.fn(),
            }),
        )
        expect(result.current.structureMainAddress).toBe(ledgerAccount.address)
        expect(result.current.structureAccounts).toEqual([
            ledgerAccount,
            subLedgerAccount,
        ])
    })

    test('Watch account: showStructure false', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: watchAccount, onClose: vi.fn() }),
        )
        expect(result.current.showStructure).toBe(false)
        expect(result.current.structureAccounts).toEqual([])
        expect(result.current.structureMainAddress).toBe('')
    })

    test('Multisig account: resolves the shared account type label', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({
                account: multisigAccount,
                onClose: vi.fn(),
            }),
        )

        expect(result.current.accountType.label).toBe(
            'account_info.type_multisig',
        )
    })

    test('RekeyedAuth account with a transition shows the "Rekeyed (from to to)" label', () => {
        mockUseAccountLogicalType.mockImplementation((address: string) =>
            address === ledgerAccount.address ? 'RekeyedAuth' : null,
        )
        mockUseRekeyTransition.mockReturnValue({
            from: 'Algo25',
            to: 'LedgerBle',
        })
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: ledgerAccount, onClose: vi.fn() }),
        )
        expect(result.current.accountType.label).toBe(
            'account_info.type_rekeyed_transition',
        )
    })

    test('RekeyedAuth account without a known auth account falls back to generic label', () => {
        mockUseAccountLogicalType.mockImplementation((address: string) =>
            address === ledgerAccount.address ? 'RekeyedAuth' : null,
        )
        mockUseRekeyTransition.mockReturnValue(null)
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: ledgerAccount, onClose: vi.fn() }),
        )
        expect(result.current.accountType.label).toBe(
            'account_info.type_rekeyed',
        )
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
            params: { account: hdAccount, notifyOnEmpty: true },
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
