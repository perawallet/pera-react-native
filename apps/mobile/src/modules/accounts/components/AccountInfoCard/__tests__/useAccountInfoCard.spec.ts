/*
 Copyright 2022-2026 Pera Wallet, LDA
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
const mockUseCanSignWith = vi.fn<() => boolean>()
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
        useCanSignWith: () => mockUseCanSignWith(),
        useRekeyTransition: () => mockUseRekeyTransition(),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    microAlgosToAlgos: (v: bigint) => ({ toString: () => String(v) }),
}))

const hdAccount: HDWalletAccount = {
    id: 'hd-account',
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
    id: 'ledger-account',
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
    id: 'watch-account',
    type: 'watch',
    address: 'WATCH_ADDR',
}

const multisigAccount: MultiSigAccount = {
    id: 'multisig-account',
    type: 'multisig',
    address: 'MULTISIG_ADDR',
    multisigDetails: {
        threshold: 2,
        addresses: ['ADDR_1', 'ADDR_2', 'ADDR_3'],
        version: 1,
    },
}

const quantumAccount: WalletAccount = {
    id: 'quantum-account',
    type: 'quantum',
    address: 'QUANTUM_ADDR',
    keyPairId: 'key-1',
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
        mockUseCanSignWith.mockReturnValue(true)
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
            id: 'ledger-sub-account',
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

    test('Quantum account: resolves the quantum account type label', () => {
        const { result } = renderHook(() =>
            useAccountInfoCard({
                account: quantumAccount,
                onClose: vi.fn(),
            }),
        )

        expect(result.current.accountType.label).toBe(
            'account_info.type_quantum',
        )
    })

    test('RekeyedSignable account with a transition shows the "Rekeyed (Signed by …)" label', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseRekeyTransition.mockReturnValue({
            from: 'algo25',
            to: 'hardware',
        })
        const rekeyed = { ...ledgerAccount, rekeyAddress: 'AUTH' }
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: rekeyed, onClose: vi.fn() }),
        )
        expect(result.current.accountType.label).toBe(
            'account_info.type_rekeyed_signer',
        )
    })

    test('RekeyedSignable account without a known auth account falls back to generic label', () => {
        mockUseCanSignWith.mockReturnValue(true)
        mockUseRekeyTransition.mockReturnValue(null)
        const rekeyed = { ...ledgerAccount, rekeyAddress: 'AUTH' }
        const { result } = renderHook(() =>
            useAccountInfoCard({ account: rekeyed, onClose: vi.fn() }),
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
