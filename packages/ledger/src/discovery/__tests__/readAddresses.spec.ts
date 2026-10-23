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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addressCodecs } from '@perawallet/wallet-core-chain-contract'
import {
    LEDGER_CONNECTION_TIMEOUT_MS,
    LedgerDeviceNotFoundError,
    type LedgerTransport,
    type LedgerTransportProvider,
} from '@perawallet/wallet-extension-ledger-shared'
import { ledgerReadableChainOf, readLedgerAddresses } from '../readAddresses'

vi.mock('@perawallet/wallet-core-hardware-wallet', () => ({
    hasLedgerAppDriver: (chainId: string) =>
        chainId === 'algorand' || chainId === 'ethereum',
}))

const transportReading = (
    addressAt: (accountIndex: number) => Promise<string>,
): LedgerTransport =>
    ({
        getAddress: vi.fn(async (accountIndex: number) => ({
            address: await addressAt(accountIndex),
            publicKey: new Uint8Array(32),
            accountIndex,
        })),
        signTransaction: vi.fn(),
        disconnect: vi.fn(async () => {}),
    }) as unknown as LedgerTransport

const providerConnecting = (
    connect: () => Promise<LedgerTransport>,
): LedgerTransportProvider =>
    ({
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: vi.fn(() => () => {}),
        connect: vi.fn(connect),
        isSupported: vi.fn(async () => true),
    }) as unknown as LedgerTransportProvider

describe('ledgerReadableChainOf', () => {
    beforeEach(() => {
        addressCodecs.reset()
        addressCodecs.register({ chainId: 'ethereum' } as never)
    })

    it('picks the first chain with both a Ledger app driver and an address codec', () => {
        expect(ledgerReadableChainOf(['polygon', 'algorand', 'ethereum'])).toBe(
            'ethereum',
        )
    })

    it('finds none when no chain qualifies', () => {
        expect(ledgerReadableChainOf(['algorand', 'polygon'])).toBeUndefined()
    })
})

describe('readLedgerAddresses', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("reads each index once in the chain's app without display, then disconnects", async () => {
        const transport = transportReading(async index => `ADDR_${index}`)
        const provider = providerConnecting(async () => transport)

        const addresses = await readLedgerAddresses({
            provider,
            deviceId: 'device',
            chainId: 'algorand',
            accountIndices: [0, 2, 0],
        })

        expect(provider.connect).toHaveBeenCalledWith('device', 'algorand')
        expect(transport.getAddress).toHaveBeenCalledTimes(2)
        expect(transport.getAddress).toHaveBeenCalledWith(0, false)
        expect(transport.getAddress).toHaveBeenCalledWith(2, false)
        expect([...addresses]).toEqual([
            [0, 'ADDR_0'],
            [2, 'ADDR_2'],
        ])
        expect(transport.disconnect).toHaveBeenCalledOnce()
    })

    it('disconnects when a read fails', async () => {
        const failure = new Error('CLA_NOT_SUPPORTED')
        const transport = transportReading(async () => {
            throw failure
        })

        await expect(
            readLedgerAddresses({
                provider: providerConnecting(async () => transport),
                deviceId: 'device',
                chainId: 'algorand',
                accountIndices: [0],
            }),
        ).rejects.toBe(failure)
        expect(transport.disconnect).toHaveBeenCalledOnce()
    })

    it('times out a read that never answers and disconnects', async () => {
        vi.useFakeTimers()
        const transport = transportReading(() => new Promise<never>(() => {}))

        const promise = readLedgerAddresses({
            provider: providerConnecting(async () => transport),
            deviceId: 'device',
            chainId: 'algorand',
            accountIndices: [0],
        })
        const assertion = expect(promise).rejects.toThrow(
            LedgerDeviceNotFoundError,
        )
        await vi.advanceTimersByTimeAsync(LEDGER_CONNECTION_TIMEOUT_MS + 1)
        await assertion
        expect(transport.disconnect).toHaveBeenCalledOnce()
    })

    it('disconnects a transport that arrives after the connect timed out', async () => {
        vi.useFakeTimers()
        const transport = transportReading(async index => `ADDR_${index}`)
        let resolveConnect: (late: LedgerTransport) => void = () => {}
        const provider = providerConnecting(
            () =>
                new Promise<LedgerTransport>(resolve => {
                    resolveConnect = resolve
                }),
        )

        const promise = readLedgerAddresses({
            provider,
            deviceId: 'device',
            chainId: 'algorand',
            accountIndices: [0],
        })
        const assertion = expect(promise).rejects.toThrow(
            LedgerDeviceNotFoundError,
        )
        await vi.advanceTimersByTimeAsync(LEDGER_CONNECTION_TIMEOUT_MS + 1)
        await assertion

        resolveConnect(transport)
        await vi.advanceTimersByTimeAsync(0)
        expect(transport.getAddress).not.toHaveBeenCalled()
        expect(transport.disconnect).toHaveBeenCalledOnce()
    })
})
