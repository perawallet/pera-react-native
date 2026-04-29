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

import { describe, it, expect } from 'vitest'
import { createHardwareWalletRegistry } from '../registry'
import type {
    HardwareWalletTransportProvider,
    LedgerTransportType,
} from '../types'

const makeProvider = (
    manufacturer: string,
    transportType: LedgerTransportType,
): HardwareWalletTransportProvider => ({
    manufacturer,
    transportType,
    scan: () => () => {},
    connect: async () => ({
        getAddress: async () => ({
            address: '',
            publicKey: new Uint8Array(32),
            accountIndex: 0,
        }),
        signTransaction: async () => new Uint8Array(64),
        disconnect: async () => {},
    }),
    isSupported: async () => true,
})

describe('createHardwareWalletRegistry', () => {
    it('starts empty', () => {
        const registry = createHardwareWalletRegistry()

        expect(registry.getAllProviders()).toEqual([])
        expect(registry.hasProvider('ledger', 'ble')).toBe(false)
        expect(registry.getProvider('ledger', 'ble')).toBeUndefined()
    })

    it('registers and retrieves a provider by (manufacturer, transportType)', () => {
        const registry = createHardwareWalletRegistry()
        const ble = makeProvider('ledger', 'ble')

        registry.register(ble)

        expect(registry.hasProvider('ledger', 'ble')).toBe(true)
        expect(registry.getProvider('ledger', 'ble')).toBe(ble)
        expect(registry.hasProvider('ledger', 'usb')).toBe(false)
    })

    it('keeps BLE and USB providers for the same manufacturer side-by-side', () => {
        const registry = createHardwareWalletRegistry()
        const ble = makeProvider('ledger', 'ble')
        const usb = makeProvider('ledger', 'usb')

        registry.register(ble)
        registry.register(usb)

        expect(registry.getProvider('ledger', 'ble')).toBe(ble)
        expect(registry.getProvider('ledger', 'usb')).toBe(usb)
        expect(registry.getAllProviders()).toHaveLength(2)
    })

    it('replaces an existing (manufacturer, transportType) on duplicate register', () => {
        const registry = createHardwareWalletRegistry()
        const a = makeProvider('ledger', 'ble')
        const b = makeProvider('ledger', 'ble')

        registry.register(a)
        registry.register(b)

        expect(registry.getProvider('ledger', 'ble')).toBe(b)
        expect(registry.getAllProviders()).toHaveLength(1)
    })

    it('getProvidersByManufacturer returns every provider for that manufacturer', () => {
        const registry = createHardwareWalletRegistry()
        const ble = makeProvider('ledger', 'ble')
        const usb = makeProvider('ledger', 'usb')
        const trezor = makeProvider('trezor', 'usb')

        registry.register(ble)
        registry.register(usb)
        registry.register(trezor)

        const ledgerProviders = registry.getProvidersByManufacturer('ledger')
        expect(ledgerProviders).toHaveLength(2)
        expect(ledgerProviders).toEqual(expect.arrayContaining([ble, usb]))
    })

    it('getAllProviders returns a new array (not internal reference)', () => {
        const registry = createHardwareWalletRegistry()
        registry.register(makeProvider('ledger', 'ble'))

        const providers1 = registry.getAllProviders()
        const providers2 = registry.getAllProviders()

        expect(providers1).not.toBe(providers2)
        expect(providers1).toEqual(providers2)
    })
})
