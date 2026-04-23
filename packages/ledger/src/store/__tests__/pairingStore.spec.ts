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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

const memoryStorage = new Map<string, string>()
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => memoryStorage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                memoryStorage.set(key, value)
            },
            removeItem: (key: string) => {
                memoryStorage.delete(key)
            },
        },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        registerStore: vi.fn(),
    }
})

import { useLedgerPairingStore } from '../pairingStore'

const device: HardwareWalletDevice = {
    id: 'device-1',
    name: 'Ledger Nano X',
    model: 'nanoX',
    rssi: -50,
    manufacturer: 'ledger',
} as HardwareWalletDevice

describe('useLedgerPairingStore', () => {
    beforeEach(() => {
        useLedgerPairingStore.getState().resetState()
        memoryStorage.clear()
    })

    it('starts with no paired devices and no pending device', () => {
        expect(useLedgerPairingStore.getState().isPaired('device-1')).toBe(
            false,
        )
        expect(useLedgerPairingStore.getState().pendingPairingDevice).toBeNull()
    })

    it('marks a device as paired and reports it on subsequent checks', () => {
        useLedgerPairingStore.getState().markPaired('device-1')

        expect(useLedgerPairingStore.getState().isPaired('device-1')).toBe(true)
    })

    it('treats markPaired as idempotent', () => {
        useLedgerPairingStore.getState().markPaired('device-1')
        useLedgerPairingStore.getState().markPaired('device-1')

        expect(useLedgerPairingStore.getState().pairedDeviceIds).toEqual([
            'device-1',
        ])
    })

    it('forgets a single device without affecting others', () => {
        useLedgerPairingStore.getState().markPaired('device-1')
        useLedgerPairingStore.getState().markPaired('device-2')

        useLedgerPairingStore.getState().forgetDevice('device-1')

        expect(useLedgerPairingStore.getState().isPaired('device-1')).toBe(
            false,
        )
        expect(useLedgerPairingStore.getState().isPaired('device-2')).toBe(true)
    })

    it('tracks the pending pairing device', () => {
        useLedgerPairingStore.getState().setPendingPairingDevice(device)

        expect(useLedgerPairingStore.getState().pendingPairingDevice?.id).toBe(
            'device-1',
        )

        useLedgerPairingStore.getState().setPendingPairingDevice(null)
        expect(useLedgerPairingStore.getState().pendingPairingDevice).toBeNull()
    })

    it('clears all state on resetState', () => {
        useLedgerPairingStore.getState().markPaired('device-1')
        useLedgerPairingStore.getState().setPendingPairingDevice(device)

        useLedgerPairingStore.getState().resetState()

        expect(useLedgerPairingStore.getState().pairedDeviceIds).toEqual([])
        expect(useLedgerPairingStore.getState().pendingPairingDevice).toBeNull()
    })
})
