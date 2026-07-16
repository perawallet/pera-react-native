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
import { discoverLedgerAccounts } from '../discoverAccounts'
import type {
    LedgerTransport,
    LedgerAccount,
} from '@perawallet/wallet-extension-ledger-react-native/protocol'
import { LedgerAppNotOpenError } from '@perawallet/wallet-extension-ledger-react-native/protocol'

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

describe('discoverLedgerAccounts', () => {
    it('discovers accounts until gap limit is reached', async () => {
        const transport = createMockTransport(3)
        const isAccountOnChain = vi.fn(async (address: string) => {
            const index = parseInt(address.split('_')[1])
            return index < 3 // Accounts 0, 1, 2 exist on-chain
        })

        const accounts = await discoverLedgerAccounts({
            transport,
            isAccountOnChain,
        })

        expect(accounts).toHaveLength(3)
        expect(accounts[0].accountIndex).toBe(0)
        expect(accounts[1].accountIndex).toBe(1)
        expect(accounts[2].accountIndex).toBe(2)
        // Indices 3-7 (not on-chain) exhaust the on-chain gap limit of 5.
        expect(transport.getAddress).toHaveBeenCalledTimes(8)
    })

    it('always includes index 0 even if not on-chain', async () => {
        const transport = createMockTransport(0)
        const isAccountOnChain = vi.fn(async () => false)

        const accounts = await discoverLedgerAccounts({
            transport,
            isAccountOnChain,
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].accountIndex).toBe(0)
        expect(accounts[0].address).toBe('ADDR_0')
    })

    it('calls onProgress for each fetched index', async () => {
        const transport = createMockTransport(1)
        const isAccountOnChain = vi.fn(async (address: string) => {
            const index = parseInt(address.split('_')[1])
            return index < 1
        })
        const onProgress = vi.fn()

        await discoverLedgerAccounts({
            transport,
            isAccountOnChain,
            onProgress,
        })

        expect(onProgress).toHaveBeenCalledWith(0)
        expect(onProgress).toHaveBeenCalledWith(1)
    })

    it('rethrows classified errors from transport', async () => {
        const transport: LedgerTransport = {
            getAddress: vi.fn(async () => {
                const error = new Error('app not open')
                ;(error as unknown as { statusCode: number }).statusCode =
                    0x6e00
                throw error
            }),
            signTransaction: vi.fn(),
            disconnect: vi.fn(),
        }

        await expect(
            discoverLedgerAccounts({ transport }),
        ).rejects.toBeInstanceOf(LedgerAppNotOpenError)
    })

    it('discovers a single account when only index 0 is on-chain', async () => {
        const transport = createMockTransport(1)
        const isAccountOnChain = vi.fn(async (address: string) => {
            const index = parseInt(address.split('_')[1])
            return index === 0
        })

        const accounts = await discoverLedgerAccounts({
            transport,
            isAccountOnChain,
        })

        expect(accounts).toHaveLength(1)
        expect(accounts[0].accountIndex).toBe(0)
    })

    it('works without isAccountOnChain callback', async () => {
        const transport = createMockTransport(5)

        const accounts = await discoverLedgerAccounts({ transport })

        // Without on-chain check, returns accounts up to gap limit + 1
        expect(accounts.length).toBeGreaterThan(0)
        expect(accounts[0].accountIndex).toBe(0)
    })
})
