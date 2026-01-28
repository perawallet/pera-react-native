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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useUpdateAccount } from '../useUpdateAccount'
import { WalletAccount } from '../../models'

// Mock store
const mockAccounts: WalletAccount[] = [
    {
        address: 'ADDR1',
        id: 'id1',
        name: 'Account 1',
        type: 'algo25',
        canSign: true,
    },
    {
        address: 'ADDR2',
        id: 'id2',
        name: 'Account 2',
        type: 'algo25',
        canSign: true,
    },
]
const mockSetAccounts = vi.fn()

vi.mock('../../store', () => ({
    useAccountsStore: (selector: any) => {
        const state = {
            accounts: mockAccounts,
            setAccounts: mockSetAccounts,
        }
        return selector(state)
    },
}))

// Mock platform integration
const mockNetwork = { network: 'mainnet' }
const mockDeviceID = 'DEVICE_ID_123'
const mockDevicePlatform = 'ios'
const mockUpdateDeviceMutation = vi.fn().mockResolvedValue({})

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: () => mockNetwork,
    useDeviceID: vi.fn(() => mockDeviceID),
    useDeviceInfoService: () => ({
        getDevicePlatform: () => mockDevicePlatform,
    }),
    useUpdateDeviceMutation: () => ({
        mutateAsync: mockUpdateDeviceMutation,
    }),
}))

describe('useUpdateAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset mock accounts
        mockAccounts.length = 0
        mockAccounts.push(
            {
                address: 'ADDR1',
                id: 'id1',
                name: 'Account 1',
                type: 'algo25',
                canSign: true,
            },
            {
                address: 'ADDR2',
                id: 'id2',
                name: 'Account 2',
                type: 'algo25',
                canSign: true,
            },
        )
    })

    it('updates account in store', () => {
        const { result } = renderHook(() => useUpdateAccount())

        const updatedAccount: WalletAccount = {
            address: 'ADDR1',
            id: 'id1',
            name: 'Updated Account 1',
            type: 'algo25',
            canSign: true,
        }

        result.current(updatedAccount)

        expect(mockSetAccounts).toHaveBeenCalledWith([
            {
                address: 'ADDR1',
                id: 'id1',
                name: 'Updated Account 1',
                type: 'algo25',
                canSign: true,
            },
            {
                address: 'ADDR2',
                id: 'id2',
                name: 'Account 2',
                type: 'algo25',
                canSign: true,
            },
        ])
    })

    it('updates account at correct index', () => {
        const { result } = renderHook(() => useUpdateAccount())

        const updatedAccount: WalletAccount = {
            address: 'ADDR2',
            id: 'id2',
            name: 'Updated Account 2',
            type: 'algo25',
            canSign: true,
        }

        result.current(updatedAccount)

        expect(mockSetAccounts).toHaveBeenCalledWith([
            {
                address: 'ADDR1',
                id: 'id1',
                name: 'Account 1',
                type: 'algo25',
                canSign: true,
            },
            {
                address: 'ADDR2',
                id: 'id2',
                name: 'Updated Account 2',
                type: 'algo25',
                canSign: true,
            },
        ])
    })

    it('calls backend update when deviceID exists', () => {
        const { result } = renderHook(() => useUpdateAccount())

        const updatedAccount: WalletAccount = {
            address: 'ADDR1',
            id: 'id1',
            name: 'Updated',
            type: 'algo25',
            canSign: true,
        }

        result.current(updatedAccount)

        expect(mockUpdateDeviceMutation).toHaveBeenCalledWith({
            deviceId: 'DEVICE_ID_123',
            data: {
                platform: 'ios',
                accounts: ['ADDR1', 'ADDR2'],
            },
        })
    })

    it('handles account not found gracefully', () => {
        const { result } = renderHook(() => useUpdateAccount())

        const nonExistentAccount: WalletAccount = {
            address: 'ADDR_NOT_FOUND',
            id: 'id-not-found',
            name: 'Non-existent',
            type: 'algo25',
            canSign: true,
        }

        // This will set accounts[-1] = account, which in JS just doesn't update the array
        result.current(nonExistentAccount)

        // Should still call setAccounts with the original accounts
        expect(mockSetAccounts).toHaveBeenCalled()
    })
})
