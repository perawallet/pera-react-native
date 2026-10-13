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

import { describe, expect, it } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { registerFakeLedgerProvider } from '../ledger'

const connectFakeLedger = async () => {
    const provider = getProvider().hardwareWalletRegistry.getProvider(
        'ledger',
        'ble',
    )
    if (!provider) throw new Error('No Ledger BLE provider registered')
    return provider.connect('test-device-id')
}

describe('registerFakeLedgerProvider', () => {
    it('reports the fixed address for every account index', async () => {
        registerFakeLedgerProvider({ address: 'FIXED' })

        const transport = await connectFakeLedger()

        await expect(transport.getAddress(3)).resolves.toMatchObject({
            address: 'FIXED',
            accountIndex: 3,
        })
    })

    it('derives the address per account index when given a function', async () => {
        registerFakeLedgerProvider({ address: index => `ADDR-${index}` })

        const transport = await connectFakeLedger()

        await expect(transport.getAddress(7)).resolves.toMatchObject({
            address: 'ADDR-7',
        })
    })

    it('signs immediately with a 64-byte signature by default', async () => {
        registerFakeLedgerProvider({ address: 'FIXED' })

        const transport = await connectFakeLedger()

        await expect(
            transport.signTransaction(0, new Uint8Array()),
        ).resolves.toEqual(new Uint8Array(64))
    })

    it('uses the supplied signer', async () => {
        const signature = new Uint8Array(64).fill(9)
        registerFakeLedgerProvider({
            address: 'FIXED',
            signTransaction: async () => signature,
        })

        const transport = await connectFakeLedger()

        await expect(
            transport.signTransaction(0, new Uint8Array()),
        ).resolves.toBe(signature)
    })
})
