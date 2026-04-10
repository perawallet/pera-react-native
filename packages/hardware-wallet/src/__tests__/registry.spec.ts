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
import type { HardwareWalletTransportProvider } from '../types'

const makeProvider = (
    manufacturer: string,
): HardwareWalletTransportProvider => ({
    manufacturer,
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
        expect(registry.hasProvider('ledger')).toBe(false)
        expect(registry.getProvider('ledger')).toBeUndefined()
    })

    it('registers and retrieves a provider', () => {
        const registry = createHardwareWalletRegistry()
        const provider = makeProvider('ledger')

        registry.register(provider)

        expect(registry.hasProvider('ledger')).toBe(true)
        expect(registry.getProvider('ledger')).toBe(provider)
        expect(registry.getAllProviders()).toHaveLength(1)
    })

    it('replaces existing provider on duplicate register', () => {
        const registry = createHardwareWalletRegistry()
        const provider1 = makeProvider('ledger')
        const provider2 = makeProvider('ledger')

        registry.register(provider1)
        registry.register(provider2)

        expect(registry.getProvider('ledger')).toBe(provider2)
        expect(registry.getAllProviders()).toHaveLength(1)
    })

    it('supports multiple manufacturers', () => {
        const registry = createHardwareWalletRegistry()
        const ledger = makeProvider('ledger')
        const trezor = makeProvider('trezor')

        registry.register(ledger)
        registry.register(trezor)

        expect(registry.getAllProviders()).toHaveLength(2)
        expect(registry.getProvider('ledger')).toBe(ledger)
        expect(registry.getProvider('trezor')).toBe(trezor)
    })

    it('getAllProviders returns a new array (not internal reference)', () => {
        const registry = createHardwareWalletRegistry()
        registry.register(makeProvider('ledger'))

        const providers1 = registry.getAllProviders()
        const providers2 = registry.getAllProviders()

        expect(providers1).not.toBe(providers2)
        expect(providers1).toEqual(providers2)
    })
})
