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

import { describe, it, expect, vi, afterEach } from 'vitest'
import { LEDGER_CONNECTION_TIMEOUT_MS } from '@perawallet/wallet-extension-ledger-shared'
import { connectAndDiscoverAccounts } from '../connectAndDiscover'
import type {
    LedgerTransport,
    LedgerTransportProvider,
    LedgerAccount,
} from '@perawallet/wallet-extension-ledger-shared'

const createMockAccount = (index: number): LedgerAccount => ({
    address: `ADDR_${index}`,
    publicKey: new Uint8Array(32).fill(index),
    accountIndex: index,
})

const createMockTransport = (accountCount: number): LedgerTransport => ({
    getAddress: vi.fn(async (index: number) => createMockAccount(index)),
    signTransaction: vi.fn(),
    disconnect: vi.fn(async () => {}),
})

const createMockProvider = (
    transport: LedgerTransport,
): LedgerTransportProvider => ({
    manufacturer: 'ledger',
    scan: vi.fn(() => () => {}),
    connect: vi.fn(async () => transport),
    isSupported: vi.fn(async () => true),
})

describe('connectAndDiscoverAccounts', () => {
    it('connects to device and discovers accounts', async () => {
        const transport = createMockTransport(2)
        const provider = createMockProvider(transport)

        const result = await connectAndDiscoverAccounts({
            provider,
            deviceId: 'test-device-id',
        })

        expect(provider.connect).toHaveBeenCalledWith('test-device-id')
        expect(result.transport).toBe(transport)
        expect(result.accounts.length).toBeGreaterThan(0)
        expect(result.accounts[0].address).toBe('ADDR_0')
    })

    it('calls onProgress callback during discovery', async () => {
        const transport = createMockTransport(3)
        const provider = createMockProvider(transport)
        const onProgress = vi.fn()

        await connectAndDiscoverAccounts({
            provider,
            deviceId: 'test-device-id',
            onProgress,
        })

        expect(onProgress).toHaveBeenCalled()
    })

    it('propagates connection errors', async () => {
        const provider: LedgerTransportProvider = {
            manufacturer: 'ledger',
            scan: vi.fn(() => () => {}),
            connect: vi.fn(async () => {
                throw new Error('Connection failed')
            }),
            isSupported: vi.fn(async () => true),
        }

        await expect(
            connectAndDiscoverAccounts({
                provider,
                deviceId: 'test-device-id',
            }),
        ).rejects.toThrow('Connection failed')
    })

    it('disconnects the transport when discovery throws after a successful connect', async () => {
        const transport = createMockTransport(0)
        ;(transport.getAddress as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('app closed on device'),
        )
        const provider = createMockProvider(transport)

        await expect(
            connectAndDiscoverAccounts({
                provider,
                deviceId: 'test-device-id',
            }),
        ).rejects.toThrow('app closed on device')

        // The caller never receives the transport on this path, so its
        // cleanup can't run — the connect owner must release the BLE link.
        expect(transport.disconnect).toHaveBeenCalled()
    })

    describe('connect timeout', () => {
        afterEach(() => {
            vi.useRealTimers()
        })

        it('rejects with a typed timeout error when connect never settles', async () => {
            vi.useFakeTimers()
            const provider: LedgerTransportProvider = {
                manufacturer: 'ledger',
                scan: vi.fn(() => () => {}),
                connect: vi.fn(() => new Promise<never>(() => {})),
                isSupported: vi.fn(async () => true),
            }

            const promise = connectAndDiscoverAccounts({
                provider,
                deviceId: 'test-device-id',
            })
            const assertion = expect(promise).rejects.toThrow(/timed out/)
            await vi.advanceTimersByTimeAsync(LEDGER_CONNECTION_TIMEOUT_MS + 1)
            await assertion
        })

        it('disconnects a transport that arrives after the timeout', async () => {
            vi.useFakeTimers()
            const transport = createMockTransport(0)
            let resolveConnect: (t: LedgerTransport) => void = () => {}
            const provider: LedgerTransportProvider = {
                manufacturer: 'ledger',
                scan: vi.fn(() => () => {}),
                connect: vi.fn(
                    () =>
                        new Promise<LedgerTransport>(resolve => {
                            resolveConnect = resolve
                        }),
                ),
                isSupported: vi.fn(async () => true),
            }

            const promise = connectAndDiscoverAccounts({
                provider,
                deviceId: 'test-device-id',
            })
            const assertion = expect(promise).rejects.toThrow(/timed out/)
            await vi.advanceTimersByTimeAsync(LEDGER_CONNECTION_TIMEOUT_MS + 1)
            await assertion

            resolveConnect(transport)
            await vi.advanceTimersByTimeAsync(0)
            expect(transport.disconnect).toHaveBeenCalled()
        })
    })
})
