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

import { describe, it, expect, vi } from 'vitest'
import { verifyAddress } from '../verify'
import type { HardwareWalletTransport } from '../types'

const makeAccount = (index: number) => ({
    address: `ADDR_${index}`,
    publicKey: new Uint8Array(32),
    accountIndex: index,
})

const makeMockTransport = (): HardwareWalletTransport => ({
    getAddress: vi
        .fn()
        .mockImplementation(async (index: number) => makeAccount(index)),
    signTransaction: vi.fn(),
    disconnect: vi.fn(),
})

describe('verifyAddress', () => {
    it('calls getAddress with verify flag set to true', async () => {
        const transport = makeMockTransport()

        await verifyAddress(transport, 3)

        expect(transport.getAddress).toHaveBeenCalledWith(3, true)
    })

    it('returns the verified account', async () => {
        const transport = makeMockTransport()

        const result = await verifyAddress(transport, 2)

        expect(result.address).toBe('ADDR_2')
        expect(result.accountIndex).toBe(2)
    })

    it('uses classifyError to wrap transport errors', async () => {
        const transport: HardwareWalletTransport = {
            ...makeMockTransport(),
            getAddress: vi.fn().mockRejectedValue(new Error('user rejected')),
        }
        const classifyError = vi.fn().mockReturnValue(new Error('classified'))

        await expect(
            verifyAddress(transport, 0, classifyError),
        ).rejects.toThrow('classified')

        expect(classifyError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('rethrows raw error when classifyError is not provided', async () => {
        const transport: HardwareWalletTransport = {
            ...makeMockTransport(),
            getAddress: vi.fn().mockRejectedValue(new Error('user rejected')),
        }

        await expect(verifyAddress(transport, 0)).rejects.toThrow(
            'user rejected',
        )
    })
})
