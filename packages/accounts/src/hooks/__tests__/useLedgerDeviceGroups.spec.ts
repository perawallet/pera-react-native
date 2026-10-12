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
import { renderHook } from '@testing-library/react'
import { useLedgerDeviceGroups } from '../useLedgerDeviceGroups'
import type { WalletAccount } from '../../models'
import { TEST_CUSTODY, testAccount } from '../../__tests__/accountFactory'

const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('../useAllAccounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

const hardware = (
    id: string,
    deviceId: string,
    deviceName: string,
    accountIndex: number,
    manufacturer = 'ledger',
): WalletAccount =>
    testAccount('hardware', `${id}-ADDR`, {
        id,
        custody: {
            kind: 'hardware',
            device: {
                ...TEST_CUSTODY.hardware.device,
                manufacturer,
                deviceId,
                deviceName,
            },
            accountIndex,
        },
    } as Partial<WalletAccount>)

const ledgerDevice1Account0 = hardware(
    'ledger-1-0',
    'device-1',
    'Cold Wallet',
    0,
)
const ledgerDevice1Account1 = hardware(
    'ledger-1-1',
    'device-1',
    'Cold Wallet',
    1,
)
const ledgerDevice1Account2 = hardware(
    'ledger-1-2',
    'device-1',
    'Cold Wallet',
    2,
)
const ledgerDevice2Account0 = hardware(
    'ledger-2-0',
    'device-2',
    'Backup Ledger',
    0,
)
const otherHardware = hardware(
    'other-1',
    'other-device',
    'Other Device',
    0,
    'other',
)
const hdAccount = testAccount('hd', 'HD_ADDRESS')
const watchAccount = testAccount('watch', 'WATCH_ADDRESS')
const singleKeyAccount = testAccount('local', 'SINGLE_ADDRESS')
const multisigAccount = testAccount('multisig', 'MULTISIG_ADDRESS')

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
        expect(group.accounts.map(a => a.custody.accountIndex)).toEqual([
            0, 1, 2,
        ])
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

    test('excludes HD, single-key, watch and multisig accounts', () => {
        mockUseAllAccounts.mockReturnValue([
            ledgerDevice1Account0,
            hdAccount,
            watchAccount,
            singleKeyAccount,
            multisigAccount,
        ])
        const { result } = renderHook(() => useLedgerDeviceGroups())

        expect(result.current.ledgerDeviceGroups).toHaveLength(1)
        expect(result.current.ledgerDeviceGroups[0].accounts).toHaveLength(1)
    })
})
