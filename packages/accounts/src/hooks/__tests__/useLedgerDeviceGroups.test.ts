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
import { renderHook } from '@testing-library/react'
import { useLedgerDeviceGroups } from '../useLedgerDeviceGroups'
import type { WalletAccount } from '../../models'

const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('../useAllAccounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

const ledgerDevice1Account0: WalletAccount = {
    id: 'ledger-1-0',
    address: 'LEDGER_DEV1_ADDR_0',
    type: 'hardware',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Cold Wallet',
        accountIndex: 0,
        transportType: 'ble',
    },
}

const ledgerDevice1Account2: WalletAccount = {
    id: 'ledger-1-2',
    address: 'LEDGER_DEV1_ADDR_2',
    type: 'hardware',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Cold Wallet',
        accountIndex: 2,
        transportType: 'ble',
    },
}

const ledgerDevice1Account1: WalletAccount = {
    id: 'ledger-1-1',
    address: 'LEDGER_DEV1_ADDR_1',
    type: 'hardware',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Cold Wallet',
        accountIndex: 1,
        transportType: 'ble',
    },
}

const ledgerDevice2Account0: WalletAccount = {
    id: 'ledger-2-0',
    address: 'LEDGER_DEV2_ADDR_0',
    type: 'hardware',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-2',
        deviceName: 'Backup Ledger',
        accountIndex: 0,
        transportType: 'ble',
    },
}

const otherHardware: WalletAccount = {
    id: 'other-1',
    address: 'OTHER_HARDWARE_ADDR',
    type: 'hardware',
    hardwareDetails: {
        manufacturer: 'other',
        deviceId: 'other-device',
        deviceName: 'Other Device',
        accountIndex: 0,
        transportType: 'ble',
    },
}

const hdAccount: WalletAccount = {
    id: 'hd-1',
    address: 'HD_ADDRESS',
    type: 'hdWallet',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
    keyPairId: 'wallet-1',
}

const watchAccount: WalletAccount = {
    id: 'watch-1',
    address: 'WATCH_ADDRESS',
    type: 'watch',
}

const algo25Account: WalletAccount = {
    id: 'algo25-1',
    address: 'ALGO25_ADDRESS',
    type: 'algo25',
    keyPairId: 'algo25-key-1',
}

const multisigAccount: WalletAccount = {
    id: 'multisig-1',
    address: 'MULTISIG_ADDRESS',
    type: 'multisig',
    multisigDetails: {
        threshold: 2,
        addresses: ['A', 'B', 'C'],
        version: 1,
    },
}

describe('useLedgerDeviceGroups', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    test('returns empty groups when no accounts exist', () => {
        const { result } = renderHook(() => useLedgerDeviceGroups())
        expect(result.current.ledgerDeviceGroups).toEqual([])
        expect(result.current.hasMultipleLedgerDevices).toBe(false)
    })

    test('returns empty groups when no Ledger accounts exist', () => {
        mockUseAllAccounts.mockReturnValue([hdAccount, watchAccount])
        const { result } = renderHook(() => useLedgerDeviceGroups())
        expect(result.current.ledgerDeviceGroups).toEqual([])
        expect(result.current.hasMultipleLedgerDevices).toBe(false)
    })

    test('groups accounts by deviceId and sorts by accountIndex', () => {
        mockUseAllAccounts.mockReturnValue([
            ledgerDevice1Account2,
            ledgerDevice1Account0,
            ledgerDevice1Account1,
        ])
        const { result } = renderHook(() => useLedgerDeviceGroups())

        expect(result.current.ledgerDeviceGroups).toHaveLength(1)
        const group = result.current.ledgerDeviceGroups[0]
        expect(group.deviceId).toBe('device-1')
        expect(group.deviceName).toBe('Cold Wallet')
        expect(group.accountCount).toBe(3)
        expect(group.accounts.map(a => a.hardwareDetails.accountIndex)).toEqual(
            [0, 1, 2],
        )
        expect(group.firstAccount).toBe(ledgerDevice1Account0)
        expect(result.current.hasMultipleLedgerDevices).toBe(false)
    })

    test('returns separate groups per device', () => {
        mockUseAllAccounts.mockReturnValue([
            ledgerDevice1Account0,
            ledgerDevice2Account0,
            ledgerDevice1Account1,
        ])
        const { result } = renderHook(() => useLedgerDeviceGroups())

        expect(result.current.ledgerDeviceGroups).toHaveLength(2)
        expect(result.current.hasMultipleLedgerDevices).toBe(true)

        const dev1 = result.current.ledgerDeviceGroups.find(
            g => g.deviceId === 'device-1',
        )!
        expect(dev1.accountCount).toBe(2)

        const dev2 = result.current.ledgerDeviceGroups.find(
            g => g.deviceId === 'device-2',
        )!
        expect(dev2.accountCount).toBe(1)
        expect(dev2.deviceName).toBe('Backup Ledger')
    })

    test('excludes non-Ledger hardware accounts', () => {
        mockUseAllAccounts.mockReturnValue([
            ledgerDevice1Account0,
            otherHardware,
        ])
        const { result } = renderHook(() => useLedgerDeviceGroups())

        expect(result.current.ledgerDeviceGroups).toHaveLength(1)
        expect(result.current.ledgerDeviceGroups[0].deviceId).toBe('device-1')
    })

    test('excludes HD, watch, algo25, multisig accounts', () => {
        mockUseAllAccounts.mockReturnValue([
            ledgerDevice1Account0,
            hdAccount,
            watchAccount,
            algo25Account,
            multisigAccount,
        ])
        const { result } = renderHook(() => useLedgerDeviceGroups())

        expect(result.current.ledgerDeviceGroups).toHaveLength(1)
        expect(result.current.ledgerDeviceGroups[0].accounts).toHaveLength(1)
    })
})
