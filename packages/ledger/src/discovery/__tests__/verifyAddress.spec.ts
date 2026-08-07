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
import { verifyLedgerAddress } from '../verifyAddress'
import type { LedgerTransport } from '@perawallet/wallet-extension-ledger-shared'
import { LedgerUserRejectedError } from '@perawallet/wallet-extension-ledger-shared'

describe('verifyLedgerAddress', () => {
    it('calls getAddress with verify=true', async () => {
        const transport: LedgerTransport = {
            getAddress: vi.fn(async index => ({
                address: `ADDR_${index}`,
                publicKey: new Uint8Array(32),
                accountIndex: index,
            })),
            signTransaction: vi.fn(),
            disconnect: vi.fn(),
        }

        const result = await verifyLedgerAddress(transport, 2)

        expect(transport.getAddress).toHaveBeenCalledWith(2, true)
        expect(result.address).toBe('ADDR_2')
        expect(result.accountIndex).toBe(2)
    })

    it('throws LedgerUserRejectedError when user rejects on device', async () => {
        const transport: LedgerTransport = {
            getAddress: vi.fn(async () => {
                const error = new Error('rejected')
                ;(error as unknown as { statusCode: number }).statusCode =
                    0x6986
                throw error
            }),
            signTransaction: vi.fn(),
            disconnect: vi.fn(),
        }

        await expect(verifyLedgerAddress(transport, 0)).rejects.toBeInstanceOf(
            LedgerUserRejectedError,
        )
    })

    it('throws LedgerUserRejectedError for legacy rejection code', async () => {
        const transport: LedgerTransport = {
            getAddress: vi.fn(async () => {
                const error = new Error('rejected')
                ;(error as unknown as { statusCode: number }).statusCode =
                    0x6985
                throw error
            }),
            signTransaction: vi.fn(),
            disconnect: vi.fn(),
        }

        await expect(verifyLedgerAddress(transport, 0)).rejects.toBeInstanceOf(
            LedgerUserRejectedError,
        )
    })
})
