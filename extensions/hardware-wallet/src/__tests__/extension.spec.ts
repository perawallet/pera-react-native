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

import { describe, it, expect } from 'vitest'
import { Provider } from '@algorandfoundation/wallet-provider'
import { WithHardwareWalletExtension } from '../extension'

describe('WithHardwareWalletExtension', () => {
    it('gives the provider an empty registry that transports can be added to', () => {
        const TestProvider = Provider.withExtensions([
            WithHardwareWalletExtension,
        ] as const)

        const provider = new TestProvider({ id: 'test', name: 'Test' })
        provider.hardwareWalletRegistry.register({
            manufacturer: 'ledger',
            transportType: 'ble',
            scan: () => () => {},
            connect: async () => {
                throw new Error('not connectable in tests')
            },
            isSupported: async () => true,
        })

        expect(
            provider.hardwareWalletRegistry.hasProvider('ledger', 'ble'),
        ).toBe(true)
        expect(
            provider.hardwareWalletRegistry.hasProvider('ledger', 'usb'),
        ).toBe(false)
    })

    it('gives each provider its own registry', () => {
        const TestProvider = Provider.withExtensions([
            WithHardwareWalletExtension,
        ] as const)

        const first = new TestProvider({ id: 'a', name: 'A' })
        const second = new TestProvider({ id: 'b', name: 'B' })

        expect(first.hardwareWalletRegistry).not.toBe(
            second.hardwareWalletRegistry,
        )
    })
})
