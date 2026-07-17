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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { warnMock } = vi.hoisted(() => ({ warnMock: vi.fn() }))
vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { warn: warnMock },
}))

import { discoverAccounts } from '../discovery'
import {
    DEFAULT_MAX_ACCOUNT_SCAN_GAP,
    DEFAULT_MAX_ACCOUNT_SCAN_INDEX,
    DEFAULT_ONCHAIN_ACCOUNT_SCAN_GAP,
} from '../constants'
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
    beforeEach(() => {
        warnMock.mockClear()
    })

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

    describe('probed scan depth and resilience', () => {
        it('finds funded accounts past unfunded gaps with the default on-chain gap', async () => {
            // A migrator with funded accounts at {0, 5} must see both in the
            // initial fetch — the on-chain gap (5, matching HD discovery)
            // carries the scan across the 4 unfunded indices in between.
            const transport = makeMockTransport()
            const onChain = new Set(['ADDR_0', 'ADDR_5'])

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async addr => onChain.has(addr),
            })

            expect(accounts.map(a => a.accountIndex)).toEqual([0, 5])
        })

        it('falls back to the capped scan when the probe is down from the start', async () => {
            // Offline / indexer-down import must keep working exactly like
            // the no-probe scan instead of failing discovery — but the
            // degradation must be diagnosable, never silent.
            const transport = makeMockTransport()

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async () => {
                    throw new Error('probe unavailable')
                },
            })

            expect(accounts.map(a => a.accountIndex)).toEqual([0, 1, 2])
            expect(warnMock).toHaveBeenCalledTimes(1)
        })

        it('keeps found accounts and completes capped when the probe dies mid-scan', async () => {
            const transport = makeMockTransport()
            let calls = 0

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async () => {
                    calls += 1
                    if (calls === 1) return true
                    throw new Error('probe unavailable')
                },
            })

            // Index 0 was probed funded; the fallback then walks the capped
            // range like a no-probe scan.
            expect(accounts.map(a => a.accountIndex)).toEqual([0, 1, 2])
        })

        it('stops at the hard index ceiling even when every account is funded', async () => {
            const transport = makeMockTransport()

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async () => true,
                maxIndex: 5,
            })

            expect(accounts.map(a => a.accountIndex)).toEqual([
                0, 1, 2, 3, 4, 5,
            ])
            expect(transport.getAddress).toHaveBeenCalledTimes(6)
        })

        it('bounds an all-funded device by the default ceiling', async () => {
            const transport = makeMockTransport()

            const accounts = await discoverAccounts({
                transport,
                isAccountOnChain: async () => true,
            })

            expect(accounts).toHaveLength(DEFAULT_MAX_ACCOUNT_SCAN_INDEX + 1)
        })

        it('exposes distinct defaults for probed vs capped scans', () => {
            expect(DEFAULT_ONCHAIN_ACCOUNT_SCAN_GAP).toBeGreaterThan(
                DEFAULT_MAX_ACCOUNT_SCAN_GAP,
            )
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

        it('returns indices 0 through default maxGap (2) inclusive', async () => {
            const transport = makeMockTransport()

            const accounts = await discoverAccounts({ transport })

            expect(accounts.map(a => a.accountIndex)).toEqual([0, 1, 2])
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
