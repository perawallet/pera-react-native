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
import { renderHook, waitFor } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    getHoldingsFromDb,
    persistHoldingsToDb,
    useHoldingsDbSync,
} from '../useAccountHoldingsDb'

const mockRefreshAccountHoldings = vi.fn()
const mockGetAccountHoldings = vi.fn()

vi.mock('../../db', () => ({
    refreshAccountHoldings: (...args: unknown[]) =>
        mockRefreshAccountHoldings(...args),
    getAccountHoldings: (...args: unknown[]) => mockGetAccountHoldings(...args),
}))

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: mockLoggerWarn,
            error: vi.fn(),
        },
    }
})

describe('getHoldingsFromDb', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns holdings from the repository', async () => {
        const rows = [{ assetId: '1', amount: new Decimal(5) }]
        mockGetAccountHoldings.mockResolvedValue(rows)

        await expect(getHoldingsFromDb('ADDR1', 'mainnet')).resolves.toBe(rows)

        expect(mockGetAccountHoldings).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            network: 'mainnet',
        })
    })

    it('warns and returns [] when the read fails', async () => {
        mockGetAccountHoldings.mockRejectedValue(new Error('boom'))

        await expect(getHoldingsFromDb('ADDR1', 'mainnet')).resolves.toEqual([])
        expect(mockLoggerWarn).toHaveBeenCalled()
    })
})

describe('persistHoldingsToDb', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('forwards holdings to the repository', async () => {
        const holdings = [
            { assetId: '1', amount: new Decimal(5), isFrozen: true },
        ]
        mockRefreshAccountHoldings.mockResolvedValue(undefined)

        await persistHoldingsToDb('ADDR1', holdings, 'mainnet')

        expect(mockRefreshAccountHoldings).toHaveBeenCalledWith({
            accountAddress: 'ADDR1',
            holdings,
            network: 'mainnet',
        })
    })

    it('warns and swallows repository errors', async () => {
        mockRefreshAccountHoldings.mockRejectedValue(new Error('boom'))

        await expect(
            persistHoldingsToDb('ADDR1', [], 'mainnet'),
        ).resolves.toBeUndefined()

        expect(mockLoggerWarn).toHaveBeenCalled()
    })
})

describe('useHoldingsDbSync', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockRefreshAccountHoldings.mockResolvedValue(undefined)
    })

    it('persists holdings when fetched with non-empty list', async () => {
        renderHook(() =>
            useHoldingsDbSync(
                'ADDR1',
                [
                    { assetId: 1, amount: 500n },
                    { assetId: '2', amount: '100' },
                ],
                true,
                'mainnet',
            ),
        )

        await waitFor(() =>
            expect(mockRefreshAccountHoldings).toHaveBeenCalledTimes(1),
        )

        const call = mockRefreshAccountHoldings.mock.calls[0][0]
        expect(call.accountAddress).toBe('ADDR1')
        expect(call.network).toBe('mainnet')
        expect(call.holdings).toEqual([
            { assetId: '1', amount: new Decimal(500), isFrozen: false },
            { assetId: '2', amount: new Decimal(100), isFrozen: false },
        ])
    })

    it('forwards the freeze flag instead of clearing it', async () => {
        renderHook(() =>
            useHoldingsDbSync(
                'ADDR1',
                [
                    { assetId: 1, amount: 500n, isFrozen: true },
                    { assetId: 2, amount: 100n },
                ],
                true,
                'mainnet',
            ),
        )

        await waitFor(() =>
            expect(mockRefreshAccountHoldings).toHaveBeenCalledTimes(1),
        )

        // refreshAccountHoldings rewrites is_frozen for every row it touches,
        // so a hardcoded false here would silently unfreeze asset 1.
        expect(mockRefreshAccountHoldings.mock.calls[0][0].holdings).toEqual([
            { assetId: '1', amount: new Decimal(500), isFrozen: true },
            { assetId: '2', amount: new Decimal(100), isFrozen: false },
        ])
    })

    it('does not persist when not fetched yet', () => {
        renderHook(() =>
            useHoldingsDbSync(
                'ADDR1',
                [{ assetId: 1, amount: 5n }],
                false,
                'mainnet',
            ),
        )

        expect(mockRefreshAccountHoldings).not.toHaveBeenCalled()
    })

    it('does not persist when holdings list is empty', () => {
        renderHook(() => useHoldingsDbSync('ADDR1', [], true, 'mainnet'))

        expect(mockRefreshAccountHoldings).not.toHaveBeenCalled()
    })
})
