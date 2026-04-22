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

import { useLedgerPairedDevicesStore } from '../useLedgerPairedDevicesStore'

describe('useLedgerPairedDevicesStore', () => {
    beforeEach(() => {
        useLedgerPairedDevicesStore.getState().resetState()
        memoryStorage.clear()
    })

    it('starts with no paired devices', () => {
        expect(
            useLedgerPairedDevicesStore.getState().isPaired('device-1'),
        ).toBe(false)
    })

    it('marks a device as paired and reports it on subsequent checks', () => {
        useLedgerPairedDevicesStore.getState().markPaired('device-1')

        expect(
            useLedgerPairedDevicesStore.getState().isPaired('device-1'),
        ).toBe(true)
    })

    it('treats markPaired as idempotent', () => {
        useLedgerPairedDevicesStore.getState().markPaired('device-1')
        useLedgerPairedDevicesStore.getState().markPaired('device-1')

        expect(useLedgerPairedDevicesStore.getState().pairedDeviceIds).toEqual([
            'device-1',
        ])
    })

    it('forgets a single device without affecting others', () => {
        useLedgerPairedDevicesStore.getState().markPaired('device-1')
        useLedgerPairedDevicesStore.getState().markPaired('device-2')

        useLedgerPairedDevicesStore.getState().forgetDevice('device-1')

        expect(
            useLedgerPairedDevicesStore.getState().isPaired('device-1'),
        ).toBe(false)
        expect(
            useLedgerPairedDevicesStore.getState().isPaired('device-2'),
        ).toBe(true)
    })

    it('clears all paired devices on resetState', () => {
        useLedgerPairedDevicesStore.getState().markPaired('device-1')
        useLedgerPairedDevicesStore.getState().markPaired('device-2')

        useLedgerPairedDevicesStore.getState().resetState()

        expect(useLedgerPairedDevicesStore.getState().pairedDeviceIds).toEqual(
            [],
        )
    })
})
