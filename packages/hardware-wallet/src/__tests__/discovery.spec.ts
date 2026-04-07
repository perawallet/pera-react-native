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
import { discoverAccounts } from '../discovery'
import type { HardwareWalletTransport } from '../types'

const makeAccount = (index: number) => ({
    address: `ADDR_${index}`,
    publicKey: new Uint8Array(32),
    accountIndex: index,
})

const makeMockTransport = (): HardwareWalletTransport => ({
    getAddress: vi.fn().mockImplementation(async (index: number) => {
        return makeAccount(index)
    }),
    signTransaction: vi.fn(),
    disconnect: vi.fn(),
})

describe('discoverAccounts', () => {
    describe('with isAccountOnChain', () => {
        it('returns funded accounts and stops after maxGap consecutive empty', async () => {
            const transport = makeMockTransport()
            const onChain = new Set(['ADDR_0', 'ADDR_1'])

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async addr => onChain.has(addr),
                maxGap: 2,
            })

            // Indices 0,1 are on-chain. 2,3 are empty (2 consecutive = maxGap).
            expect(accounts.map(a => a.accountIndex)).toEqual([0, 1])
        })

        it('always includes index 0 even if not funded', async () => {
            const transport = makeMockTransport()

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async () => false,
                maxGap: 1,
            })

            expect(accounts).toHaveLength(1)
            expect(accounts[0].accountIndex).toBe(0)
        })

        it('resets consecutive empty count when funded account found', async () => {
            const transport = makeMockTransport()
            const onChain = new Set(['ADDR_0', 'ADDR_2'])

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async addr => onChain.has(addr),
                maxGap: 2,
            })

            // 0: funded, 1: empty (1), 2: funded (reset), 3: empty (1), 4: empty (2 = maxGap, stop)
            expect(accounts.map(a => a.accountIndex)).toEqual([0, 2])
        })
    })

    describe('without isAccountOnChain', () => {
        it('returns indices 0 through maxGap inclusive', async () => {
            const transport = makeMockTransport()

            const accounts = await discoverAccounts({
                transport,
                maxGap: 2,
            })

            expect(accounts.map(a => a.accountIndex)).toEqual([0, 1, 2])
        })

        it('returns indices 0 and 1 with default maxGap (1)', async () => {
            const transport = makeMockTransport()

            const accounts = await discoverAccounts({ transport })

            expect(accounts.map(a => a.accountIndex)).toEqual([0, 1])
        })
    })

    it('calls onProgress for each index', async () => {
        const transport = makeMockTransport()
        const onProgress = vi.fn()

        await discoverAccounts({
            transport,
            onProgress,
            maxGap: 2,
        })

        expect(onProgress).toHaveBeenCalledWith(0)
        expect(onProgress).toHaveBeenCalledWith(1)
        expect(onProgress).toHaveBeenCalledWith(2)
    })

    it('uses classifyError to wrap transport errors', async () => {
        const transport: HardwareWalletTransport = {
            ...makeMockTransport(),
            getAddress: vi.fn().mockRejectedValue(new Error('raw error')),
        }

        const classified = new Error('classified error')
        const classifyError = vi.fn().mockReturnValue(classified)

        await expect(
            discoverAccounts({ transport, classifyError }),
        ).rejects.toThrow('classified error')

        expect(classifyError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('rethrows raw error when classifyError is not provided', async () => {
        const transport: HardwareWalletTransport = {
            ...makeMockTransport(),
            getAddress: vi.fn().mockRejectedValue(new Error('raw error')),
        }

        await expect(discoverAccounts({ transport })).rejects.toThrow(
            'raw error',
        )
    })
})
