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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useUpdateAccount } from '../useUpdateAccount'
import type { WalletAccount } from '../../models'
import { testAccount } from '../../__tests__/accountFactory'

const account1 = () =>
    testAccount('local', 'ADDR1', { id: 'id1', name: 'Account 1' })
const account2 = () =>
    testAccount('local', 'ADDR2', { id: 'id2', name: 'Account 2' })

const mockAccounts: WalletAccount[] = []
const mockSetAccounts = vi.fn()

// useUpdateAccount reads `accounts` via `useAccountsStore.getState()`
// inside the handler (to avoid stale closures over a captured snapshot).
// The mock therefore needs to expose getState() in addition to the
// selector-style hook call.
const mockStore = {
    getState: () => ({
        accounts: mockAccounts,
        setAccounts: mockSetAccounts,
    }),
}
vi.mock('../../store', () => ({
    useAccountsStore: Object.assign(
        (selector: any) => selector(mockStore.getState()),
        { getState: () => mockStore.getState() },
    ),
}))

// Mock platform integration
const mockNetwork = { network: 'mainnet' }
const mockDeviceID = 'DEVICE_ID_123'
const mockDevicePlatform = 'ios'
const mockRegisterDeviceMutation = vi.fn().mockResolvedValue({})

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: vi.fn(() => mockDeviceID),
    useRegisterDeviceMutation: () => ({
        mutateAsync: mockRegisterDeviceMutation,
    }),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: {
            getDevicePlatform: () => mockDevicePlatform,
        },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useNetwork: () => mockNetwork,
}))

describe('useUpdateAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts.length = 0
        mockAccounts.push(account1(), account2())
    })

    it('replaces the account with the same id', () => {
        const { result } = renderHook(() => useUpdateAccount())

        result.current({ ...account1(), name: 'Updated Account 1' })

        expect(mockSetAccounts).toHaveBeenCalledWith([
            { ...account1(), name: 'Updated Account 1' },
            account2(),
        ])
    })

    it('matches by id, not by address', () => {
        const { result } = renderHook(() => useUpdateAccount())
        const moved = testAccount('local', 'ADDR1', {
            id: 'id2',
            name: 'Same address, other id',
        })

        result.current(moved)

        expect(mockSetAccounts).toHaveBeenCalledWith([account1(), moved])
    })

    it('writes the account as passed, keeping its custody and chains', () => {
        const hardware = testAccount('hardware', 'LEDGER', { id: 'hw' })
        mockAccounts.push(hardware)
        const { result } = renderHook(() => useUpdateAccount())

        result.current({ ...hardware, name: 'Renamed' })

        const written = mockSetAccounts.mock.calls[0][0] as WalletAccount[]
        expect(written[2]).toEqual({ ...hardware, name: 'Renamed' })
    })

    it('does not touch the device API — registration is the single writer', () => {
        const { result } = renderHook(() => useUpdateAccount())

        result.current({ ...account1(), name: 'Updated' })

        expect(mockRegisterDeviceMutation).not.toHaveBeenCalled()
    })

    it('leaves the list unchanged for an unknown id', () => {
        const { result } = renderHook(() => useUpdateAccount())

        result.current(
            testAccount('local', 'ADDR_NOT_FOUND', { id: 'missing' }),
        )

        expect(mockSetAccounts).toHaveBeenCalledWith([account1(), account2()])
    })
})
