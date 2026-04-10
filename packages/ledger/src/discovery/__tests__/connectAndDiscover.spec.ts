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

import { describe, it, expect, vi } from 'vitest'
import { connectAndDiscoverAccounts } from '../connectAndDiscover'
import type {
    LedgerTransport,
    LedgerTransportProvider,
    LedgerAccount,
} from '../../types'

const createMockAccount = (index: number): LedgerAccount => ({
    address: `ADDR_${index}`,
    publicKey: new Uint8Array(32).fill(index),
    accountIndex: index,
})

const createMockTransport = (accountCount: number): LedgerTransport => ({
    getAddress: vi.fn(async (index: number) => createMockAccount(index)),
    signTransaction: vi.fn(),
    disconnect: vi.fn(),
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
})
